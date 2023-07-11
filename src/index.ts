import {readFile, writeFile} from 'fs/promises';

export interface IniEntry {
	section?: string;
	key: string;
	value: string;
}

function isSectionLine(line: string): boolean {
	return line.startsWith('[') && line.endsWith(']');
}

function getSectionName(line: string): string {
	return line.substring(1, line.length - 1);
}

function startOfSection(index: number, line: string, setSection: (section: string | undefined) => void, logger?: Console): number {
	const sectionName = getSectionName(line);
	logger?.log(`start of [${sectionName}] section`);
	setSection(sectionName);
	return index + 1;
}

/**
 * Try to solve if we are at the end of the section or end of the file
 */
function isEndOfSection(index: number, line: string, lines: string[], currentSection: string | undefined): currentSection is string {
	return Boolean(currentSection) && (!line.includes('=') || lines.length === index + 1);
}

function buildMissingSections(lines: string[], variables: IniEntry[]) {
	const lineSections = lines.reduce<string[]>((acc, line) => {
		if (isSectionLine(line)) {
			acc.push(getSectionName(line));
		}
		return acc;
	}, []);
	const requiredSections = variables.reduce<string[]>((acc, variable) => {
		if (variable.section && !acc.includes(variable.section)) {
			acc.push(variable.section);
		}
		return acc;
	}, []);
	// add missing sections to the end of the file
	const missingSections = requiredSections.filter((section) => !lineSections.includes(section));
	for (const section of missingSections) {
		lines.push('', `[${section}]`);
	}
}

export function addMissingSectionLines(index: number, lines: string[], currentVariables: Set<IniEntry>, currentSection: string, logger?: Console): number {
	logger?.log(`end of [${currentSection}] section`);
	const thisSection = Array.from(currentVariables).filter((variable) => variable.section === currentSection);
	if (thisSection.length > 0) {
		thisSection.forEach((variable) => currentVariables.delete(variable)); // remove processed variables
		const sectionLines = thisSection.map((variable) => `${variable.key}=${variable.value}`);
		// push new section data to the end of section
		lines.splice(index - 1, 0, ...sectionLines);
	}
	return index + thisSection.length;
}

function buildDefaultSectionLines(currentVariables: Set<IniEntry>): string[] {
	const defaultSectionLines: string[] = [];
	for (const e of currentVariables) {
		// we should not have any variables with section
		if (e.section) {
			throw new Error(`Section ${e.section} not found in ini file`);
		}
		defaultSectionLines.push(`${e.key}=${e.value}`);
		currentVariables.delete(e);
	}
	return defaultSectionLines;
}

function findEntry(currentVariables: Set<IniEntry>, key: string, section: string | undefined): IniEntry | undefined {
	return Array.from(currentVariables).find((variable) => variable.key === key && (section ? variable.section === section : true));
}

/**
 * add new keys without section to the end of the file or just before the first section
 */
function pushDefaultSectionLines(lines: string[], currentVariables: Set<IniEntry>, firstSectionLine: number | undefined) {
	const defaultSectionLines = buildDefaultSectionLines(currentVariables);
	if (defaultSectionLines.length > 0) {
		if (firstSectionLine === undefined) {
			lines.push(...defaultSectionLines); // if no sections found, add new keys to the end of the file
		} else {
			lines.splice(firstSectionLine, 0, ...defaultSectionLines); // add just before the first section
		}
	}
}

export function handleIniData(lines: string[], variables: IniEntry[], logger?: Console): string[] {
	buildMissingSections(lines, variables);
	let firstSectionLine: number | undefined;
	const currentVariables = new Set<IniEntry>(variables);
	let currentSection: string | undefined;
	const setSection = (section: string | undefined) => {
		currentSection = section;
	};

	let idx = 0;
	while (idx < lines.length) {
		const line = lines[idx];
		const trimmedLine = line.trim();
		if (trimmedLine.startsWith('#')) {
			idx++;
			continue;
		}
		if (isSectionLine(trimmedLine)) {
			if (firstSectionLine === undefined) {
				firstSectionLine = idx;
			}
			idx = startOfSection(idx, trimmedLine, setSection, logger);
			continue;
		}
		if (isEndOfSection(idx, trimmedLine, lines, currentSection)) {
			idx = addMissingSectionLines(idx, lines, currentVariables, currentSection, logger);
			currentSection = undefined;
			continue;
		}
		const [key] = trimmedLine.split('=');
		const entry = findEntry(currentVariables, key, currentSection);
		if (entry) {
			logger?.log('found entry', entry, 'in section', currentSection, 'in line', idx);
			currentVariables.delete(entry); // remove processed entry
			lines[idx] = `${key}=${entry.value}`;
		}
		idx++;
	}
	// handle values without section
	pushDefaultSectionLines(lines, currentVariables, firstSectionLine);
	return lines;
}

export async function writeIniData(filePath: string, variables: IniEntry[]) {
	const lines = (await readFile(filePath, 'utf-8')).toString().split('\n');
	writeFile(filePath, handleIniData(lines, variables).join('\n'));
}
