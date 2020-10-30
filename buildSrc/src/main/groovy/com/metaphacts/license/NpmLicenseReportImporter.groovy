package com.metaphacts.license;

import com.github.jk1.license.importer.DependencyDataImporter
import com.github.jk1.license.ImportedModuleBundle
import com.github.jk1.license.ImportedModuleData

/**
 * An importer for NPM JSON license reports
 * See projec/webpack/build.gradle task generateNpmLicenseReportFiles
 */
class NpmLicenseReportImporter implements DependencyDataImporter {

	static final def LICENSE_URL_MAP = [:]
	static {
		LICENSE_URL_MAP['Apache-2.0'] = 'https://www.apache.org/licenses/LICENSE-2.0'
		LICENSE_URL_MAP['MIT'] = 'https://opensource.org/licenses/MIT'
		LICENSE_URL_MAP['LGPL-2.1'] = 'http://www.gnu.org/licenses/lgpl-2.1.html'
		LICENSE_URL_MAP['GNU Lesser General Public License v3.0'] = 'http://www.gnu.de/documents/lgpl-3.0.en.html'
		LICENSE_URL_MAP['ISC'] = 'http://opensource.org/licenses/ISC'
		LICENSE_URL_MAP['MPL-2.0'] = 'http://opensource.org/licenses/MPL-2.0'
		LICENSE_URL_MAP['WTFPL'] = 'http://www.wtfpl.net/txt/copying/'
		LICENSE_URL_MAP['https://www.highcharts.com/license'] = 'https://www.highcharts.com/license'
	}

	String importerName
	
	// list of package.json files serving as source
	private List<File> files;
	
	// list of frontend module names to exclude
	private List<String> excludes;
	
	// an optional normalizer for module metadata
	NpmLicenseItemNormalizer moduleNormalizer = null;

	public NpmLicenseReportImporter(String importerName, List<File> files, List<String> excludes = []) {
		this.importerName = importerName;
		this.files = files;
		this.excludes = excludes;
	}

	@Override
	Collection<ImportedModuleBundle> doImport() {
		def bundles = new HashSet<ImportedModuleBundle>();
		
		def modules = []
		for (File file : files) {
			def reportJson = new groovy.json.JsonSlurper().parse(file);
						
			reportJson.each {
				if (!excludes.contains(it.name)) {
					modules << handleModule(it);
				}
			}
		}
		
		ImportedModuleBundle bundle = new ImportedModuleBundle(importerName, modules)
		return [bundle];
	}
	
	ImportedModuleData handleModule(Object obj) {
		ImportedModuleData res = new ImportedModuleData(
					name: obj.name,
					version: obj.comment,
					projectUrl: obj.link,
					license: obj.licenseType,
					licenseUrl: LICENSE_URL_MAP.get(obj.licenseType, "n/a")
				)	
		
		if (moduleNormalizer != null) {
			res = moduleNormalizer.normalize(res);
		}
		
		return res;
	}
	
	
}