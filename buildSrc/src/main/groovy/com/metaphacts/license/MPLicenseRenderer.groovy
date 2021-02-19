package com.metaphacts.license;

import com.github.jk1.license.License
import com.github.jk1.license.LicenseReportExtension
import com.github.jk1.license.ModuleData
import com.github.jk1.license.ProjectData
import com.github.jk1.license.ImportedModuleBundle
import com.github.jk1.license.ImportedModuleData
import com.github.jk1.license.render.*
import com.github.jk1.license.render.LicenseDataCollector.MultiLicenseInfo
import org.gradle.api.tasks.Input
import org.gradle.api.Project

/**
 * A report renderer that produces a report where dependencies
 * are grouped by license, and moreover by module. 
 *
 * @author Andreas Schwarte (as@metaphacts.com)
 */
class MPLicenseRenderer implements ReportRenderer {

	String filename
	
	// comparator for sorting licenses of a module if dual licensed
	// => implementation picks the one sorted first
	Comparator<License> licenseComparator
	
	// whether to render the modules as links or plain
	boolean renderLinks = true;
	
	// the optional name for main modules (used as title)
	String modulesBundleName = null;
	
	

	private Project project;

	MPLicenseRenderer(String filename = 'index.html', Comparator<License> licenseComparator = { a,b -> a.name <=> b.name ?: a.url <=> b.url }) {
		this.filename = filename
		this.licenseComparator = licenseComparator
	}
	
	@Input
	private String getFileNameCache() { return this.filename }

	@Override
	void render(ProjectData data) {
		
		project = data.project
		LicenseReportExtension config = data.project.licenseReport
		File output = new File(config.outputDir, filename)
		output.write('')

		output.text = """
<html>
<head>
<title>Dependency License Report</title>
<style>
	
	table {
		border-collapse: collapse;
	}

	table, th, td {
		border: 1px solid black;
	}
	
	td, th {
		padding: 5px;
	}
	
	th {
		font-weight: bold;
		text-align: left;
	}
</style>
<head>
<body>
<div class="container">
<h1>Third Party Libraries</h1>
"""

		// backend dependencies
		if (modulesBundleName != null) {
			output << "<br/><h2> " + modulesBundleName + "<h2>\n";
		}
		Map<License, List<ModuleGroup>> licenseToModules = licenseToModuleGroup(data) ;
		for (License license : licenseToModules.keySet().sort()) {
			
			output << "<h3>${license.name}</h3>\n"
			output << "<p><i>Click <a href='${license.url}' target='_BLANK'>${license.url}</a> to see full license.</i></p>"
			
			output << "<table>\n"
			output << "<tr><th>Library</th><th>Version</th><th>Subpackage(s)</th></tr>\n"
			for (ModuleGroup m : licenseToModules[license]) {
			
				output << "<tr><td>${m.moduleGroup}</td><td>${m.version}</td><td>" + (renderLinks ? m.modulesStringHtml() : m.modulesStringPlain())+ "</td></tr>\n"
			}
			output << "</table>\n"
		}
		
		// other libraries (if defined):
		if (!data.importedModules.isEmpty()) {
		
			for (def bundle : data.importedModules) {
				
				output << "<br/><br/><h2> " + bundle.name + "<h2>\n";
				
				def licenseToImportedModuleData = licenseToImportedModuleData(bundle);
				
				for (License license : licenseToImportedModuleData.keySet().sort()) {
					output << "<h3>${license.name}</h3>\n"
					output << "<p><i>Click <a href='${license.url}' target='_BLANK'>${license.url}</a> to see full license.</i></p>"
					output << "<table>\n"
					output << "<tr><th>Library</th><th>Version</th>" + (renderLinks ? "<th>Project URL</th>" : "") + "</tr>\n"
					for (ImportedModuleData m : licenseToImportedModuleData[license].sort()) {
						output << "<tr><td>${m.name}</td><td>${m.version}</td>" + (renderLinks ? "<td>${m.projectUrl}</td>" : "") + "</tr>\n"
					}
					output << "</table>\n"
				}
			}
		}
		
		
		// statistics 
		output << "<h2>Statistics</h2>\n"
		output << "<p>"
		output << "<b>Version:</b> " + project.rootProject.version + "<br/>\n"
		output << "<b>Generated at:</b> " + new Date() + "<br/>\n"
		output << "<b>" + (modulesBundleName ?: "Module dependencies") + ":</b> " + countDependencies(licenseToModules) + "<br/>\n"
		for (def bundle : data.importedModules) {
			output << "<b>" + bundle.name + "</b> " + bundle.modules.size() + "<br/>\n"
		}
		output << "</p>"
		
		output << """
</div>
</body>
</html>
"""
	}
	
	
	Map<License, List<ModuleGroup>> licenseToModuleGroup(ProjectData data) {
	
		
		Map<License, List<ModuleGroup>> res = [:]
		
		for (ModuleGroup m : moduleGroups(data)) {
			m.collectLicenseInfos()
			if (!res.containsKey(m.appliedLicense)) res[m.appliedLicense] = [];
			res[m.appliedLicense] << m;
		}
		
		return res
	}
	
	Collection<ModuleGroup> moduleGroups(ProjectData data) {
	
		// key is moduleGroup + version
		Map<String, ModuleGroup> moduleGroupMap = [:]
		

		data.allDependencies.each {
			String key = it.group + "_" + it.version
			if (!moduleGroupMap.containsKey(key)) {
				moduleGroupMap[key] = new ModuleGroup(it);
			} else {
				// add to existing module group
				moduleGroupMap[key].modules << it;
			}
		}
		return moduleGroupMap.values();
	}
	
	int countDependencies(Map<License, List<ModuleGroup>> licenseToModules) {
		int c=0;
		for (List<ModuleGroup> moduleGroups : licenseToModules.values()) {
			moduleGroups.each { c += it.modules.size() };
		}
		return c;
	}
	
	Map<License, List<ImportedModuleData>> licenseToImportedModuleData(ImportedModuleBundle bundle) {
		
		Map<String, ImportedModuleData> res = [:]
		for (def module : bundle.modules) {
			License license = new License(name: module.license, url: module.licenseUrl)
			if (!res.containsKey(license)) res[license] = [];
			res[license] << module
		}
		return res;
	}
	
	/**
	 * Combines modules of the same group (that moreover have the same version)
	 */
	class ModuleGroup {
	
		final String moduleGroup;
		final String version;
		List<ModuleData> modules = []
		Map<ModuleData, MultiLicenseInfo> moduleToLicenseInfo = [:]
		License appliedLicense;
		
		ModuleGroup(ModuleData moduleData) {
			this.moduleGroup = moduleData.group
			this.version = moduleData.version
			modules << moduleData
		}
		
		
		void collectLicenseInfos() {
			modules.each {
				moduleToLicenseInfo[it] = LicenseDataCollector.multiModuleLicenseInfo(it)
			}
			appliedLicense = extractLicense()
		}
		
		
		/**
		 * Extract the single license from all modules of the group.
		 * If there is no overlap, throw an error.
		 */
		License extractLicense() {
			
			License mappedLicense = null;
			for (MultiLicenseInfo m : moduleToLicenseInfo.values()) {
				License l = m.licenses ? m.licenses.sort(true, licenseComparator).first() : new License("Unknown")
				if (mappedLicense == null) {
					mappedLicense = l;
				} else if (mappedLicense.name != l.name) {
					
					// inspect if picked license is available
					if (!(m.licenses.any { it.name = mappedLicense.name })) {
						throw new IllegalStateException("License for group " + moduleGroup + 
							" could not be uniquely determined. Expected: " + mappedLicense.name + 
							". Found: " + m.licenses)
					}
				}
			}
			return mappedLicense;
		}
		
		String modulesString() {
			return modules.collect {"${it.name}"}.join(", ");
		}
		
		String modulesStringPlain() {
			return modules.collect {"${it.name}"}.join(", ");
		}
		
		String modulesStringHtml() {
			return modules.collect { moduleStringHtml(it) }.join(", ");
		}
		
		String moduleStringHtml(ModuleData module) {
			String projectUrl = projectUrl(module)
			String title = "" + projectDescription(module) + "\n\nLicense:" + allLicenses(module)
			String display = projectUrl ? "<a href='${projectUrl}' target='_BLANK'>${module.name}</a>" : module.name;
			return "<span title='${title}'>${display}</span>"
		}
		
		String projectUrl(ModuleData module) {
			String projectUrl = null;
			projectUrl = module.poms ? module.poms.first().projectUrl : null
			if (projectUrl == null || projectUrl == '') {
				projectUrl = module.manifests ? module.manifests.first().url : null
			}
			return projectUrl;
		}
		
		String projectDescription(ModuleData module) {
			String projectDescription = null;
			projectDescription = module.poms ? module.poms.first().description : null
			if (projectDescription == null || projectDescription == '') {
				projectDescription = module.manifests ? module.manifests.first().description : null
			}
			return projectDescription;
		}
		
		String allLicenses(ModuleData module) {
			return moduleToLicenseInfo[module].licenses.collect {"${it.name?:it.url}"}.join(", ");
		}
	}
	
}