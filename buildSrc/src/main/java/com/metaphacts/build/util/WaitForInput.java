package com.metaphacts.build.util;

import java.io.IOException;

/**
 * Utility class to wait for user input
 * 
 * <pre>
 * task testMe() {
 * 	doLast {
 *		project.javaexec {
 *			classpath rootProject.file('buildSrc/target/classes/java/main')
 *			main = 'com.metaphacts.build.util.WaitForInput'
 *			standardInput = System.in
 *		}
 *	}
 *}
 * </pre>
 * 
 * @author Andreas Schwarte
 *
 */
public class WaitForInput {

	public static void main(String[] args) throws IOException {
		
		String msg = "Press any key to continue ...";
		if (args.length > 0) {
			msg = args[0];
		}
		System.out.println(msg);
		System.in.read();

	}

}
