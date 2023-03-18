import {
	App, Editor, MarkdownView,
	Modal, Notice, Plugin,
	PluginSettingTab, Setting,
	TFile, TFolder,
	TAbstractFile
} from 'obsidian';

// Remember to rename these classes and interfaces!

interface TOCFilesPluginSettings {
	sTOCFileName: string;
	sBasePath: string;
	sHistoryFileName: string;
}

const DEFAULT_SETTINGS: TOCFilesPluginSettings = {
	sTOCFileName: 'README.md',
	sBasePath: './',
	sHistoryFileName: '',
}

export default class TOCFilesPlugin extends Plugin {
	aFiles: TFile[];
	settings: TOCFilesPluginSettings;

	async getFilesRecursively() {
		const files = await window.app.vault.getMarkdownFiles();

		const result = {
			files: [],
			folders: {},
		} as any;

		for (const file of files) {
			const relativePath = file.path
			const parts = relativePath.split('/');

			let current = result;
			for (const part of parts.slice(0, -1)) {
				if (!current.folders[part]) {
					current.folders[part] = {
						files: [],
						folders: {},
					};
				}
				current = current.folders[part];
			}

			const fileName = parts[parts.length - 1] as any;
			current.files.push(fileName);
		}

		return result;
	}

	async listFilesRecursive(path: string) {
		const folder = await this.app.vault.getAbstractFileByPath(path);

		if (folder instanceof TFolder) {
			const files: any = await Promise.all(folder.children.map(child => this.listFilesRecursive(child.path)));
			return [].concat(...files);
			// .filter((f: any) => f.name.match(/\.md$/))
		} else if (folder instanceof TFile) {
			return [folder];
		} else {
			return [];
		}
	}

	async fnGetFileTree() {
		const files = await this.listFilesRecursive('/');
		return files.map((file: any) => file.path);
	}

	fnGenerateList(aFiles: any, sPath="", iLevel=0) {
		let sTOC = ""
		for (const sFile of aFiles.files) {
			let sP = this.settings.sBasePath.replace(/\/$/, "") + "/";
			sP = sP+encodeURI(`${sPath+"/"+sFile}`).replace(/^\//, "")
			sTOC += "  ".repeat(iLevel) + " - " + `[${sFile}](${sP})` + "\n"
		}
		for (const [sFile, oFile] of Object.entries(aFiles.folders)) {
			sTOC += "  ".repeat(iLevel) + " - " + sFile + "\n"
			sTOC += this.fnGenerateList(oFile, sPath+"/"+sFile, iLevel+1)
		}

		return sTOC;
	}

	async fnGenerateTOC() {
		this.aFiles = this.app.vault.getMarkdownFiles();

		const sTOCFileName = this.settings.sTOCFileName;
		const file = this.app.vault.getAbstractFileByPath(sTOCFileName);
		if (file instanceof TFile) {
			// const files = await this.fnGetFileTree()
			const rfiles = await this.getFilesRecursively()

			let sTOCContent = "";

			sTOCContent = this.fnGenerateList(rfiles)

			let content = await this.app.vault.read(file);

			sTOCContent = `<!-- TOC -->\n${sTOCContent}\n<!-- TOC -->`
			content = content.replace(/<!-- TOC -->([^]*?)<!-- TOC -->/, sTOCContent)
			this.app.vault.modify(file, content)
		} else {
			console.error(`${sTOCFileName} is not a file`);
		}
	}

	async getFilesListOrderedByTime(): Promise<TFile[]> {
		let files = await window.app.vault.getMarkdownFiles();

		files = files.filter((o) => 
			!~[this.settings.sTOCFileName, this.settings.sHistoryFileName].indexOf(o.basename)
		)
		files.sort((a, b) => b.stat.mtime - a.stat.mtime);

		return files
	}

	fnGenerateHistoryList(aFiles: TFile[]): string {
		let sTOC = "";

		for (const oFile of aFiles) {
			let sP = this.settings.sBasePath.replace(/\/$/, "") + "/";
			sP = sP+encodeURI(`${oFile.path}`).replace(/^\//, "")
			sTOC += " - " + `[${oFile.path}](${sP})` + "\n"
		}

		return sTOC;
	}

	async fnGenerateHistoryTable() {
		const sHistoryFileName = this.settings.sHistoryFileName;
		const file = this.app.vault.getAbstractFileByPath(sHistoryFileName);

		if (file instanceof TFile) {
			// const files = await this.fnGetFileTree()
			const rfiles = await this.getFilesListOrderedByTime()

			let sTOCContent = "";

			sTOCContent = this.fnGenerateHistoryList(rfiles)

			let content = await this.app.vault.read(file);

			sTOCContent = `<!-- HTOC -->\n${sTOCContent}\n<!-- HTOC -->`
			content = content.replace(/<!-- HTOC -->([^]*?)<!-- HTOC -->/, sTOCContent)
			this.app.vault.modify(file, content)
		} else {
			console.error(`${sHistoryFileName} is not a file`);
		}
	}
	
	async fnGenerate() {
		this.fnGenerateTOC();
		this.fnGenerateHistoryTable();
	}

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.fnGenerate()

		this.registerEvent(this.app.vault.on('rename', (file) => this.fnGenerate()));
		this.registerEvent(this.app.vault.on('create', (file) => this.fnGenerate()));
		this.registerEvent(this.app.vault.on('delete', (file) => this.fnGenerate()));
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (!~[this.settings.sTOCFileName, this.settings.sHistoryFileName].indexOf(file.name)) {
				this.fnGenerate();
			}
		}));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: TOCFilesPlugin;

	constructor(app: App, plugin: TOCFilesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('File for TOC')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('README.md')
				.setValue(this.plugin.settings.sTOCFileName)
				.onChange(async (value) => {
					this.plugin.settings.sTOCFileName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Base path')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('./')
				.setValue(this.plugin.settings.sBasePath)
				.onChange(async (value) => {
					this.plugin.settings.sBasePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File with files changes history table')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('HISTORY.md')
				.setValue(this.plugin.settings.sHistoryFileName)
				.onChange(async (value) => {
					this.plugin.settings.sHistoryFileName = value;
					await this.plugin.saveSettings();
				}));
	}
}
