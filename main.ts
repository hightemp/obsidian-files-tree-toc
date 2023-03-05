import {
	App, Editor, MarkdownView,
	Modal, Notice, Plugin,
	PluginSettingTab, Setting,
	TFile, TFolder
} from 'obsidian';

// Remember to rename these classes and interfaces!

interface TOCFilesPluginSettings {
	sTOCFileName: string;
}

const DEFAULT_SETTINGS: TOCFilesPluginSettings = {
	sTOCFileName: 'README.md'
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
			const sP = encodeURI(`${sPath+"/"+sFile}`)
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
		// const files = await this.fnGetFileTree()
		const rfiles = await this.getFilesRecursively()

		let sTOCContent = "";

		sTOCContent = this.fnGenerateList(rfiles)

		if (file instanceof TFile) {
			let content = await this.app.vault.read(file);

			sTOCContent = `<!-- TOC -->\n${sTOCContent}\n<!-- TOC -->`
			content = content.replace(/<!-- TOC -->([^]*?)<!-- TOC -->/, sTOCContent)
			this.app.vault.modify(file, content)
		} else {
			console.error(`${sTOCFileName} is not a file`);
		}
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

		this.fnGenerateTOC()

		this.registerEvent(this.app.vault.on('rename', (file) => {
			this.fnGenerateTOC()
		}));

		this.registerEvent(this.app.vault.on('create', (file) => {
			this.fnGenerateTOC()
		}));

		this.registerEvent(this.app.vault.on('delete', (file) => {
			this.fnGenerateTOC()
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
	}
}
