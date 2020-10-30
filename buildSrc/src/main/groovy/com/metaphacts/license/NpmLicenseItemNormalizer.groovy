package com.metaphacts.license;

import com.github.jk1.license.ImportedModuleData

/**
 * Normalizer for module bundles
 */
interface NpmLicenseItemNormalizer {

	/**
	 * Normalize the given module, return the module unmodified if no normalization is required
	 */
	public ImportedModuleData normalize(ImportedModuleData module);
}