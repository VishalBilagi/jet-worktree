import type { AppCandidate, InstalledApp } from "./apps"
import { getInstalledApps, openInstalledApp } from "./apps"

export type InstalledIde = InstalledApp

const ideCandidates: AppCandidate[] = [
  { id: "vscode", name: "VS Code", appName: "Visual Studio Code", bundleId: "com.microsoft.VSCode", iconClass: "devicon-vscode-plain" },
  { id: "cursor", name: "Cursor", appName: "Cursor", iconClass: null },
  { id: "zed", name: "Zed", appName: "Zed", iconClass: null },
  { id: "windsurf", name: "Windsurf", appName: "Windsurf", iconClass: null },
  { id: "intellij", name: "IntelliJ IDEA", appName: "IntelliJ IDEA", bundleId: "com.jetbrains.intellij", iconClass: "devicon-intellij-plain" },
  { id: "webstorm", name: "WebStorm", appName: "WebStorm", bundleId: "com.jetbrains.WebStorm", iconClass: "devicon-webstorm-plain" },
  { id: "pycharm", name: "PyCharm", appName: "PyCharm", bundleId: "com.jetbrains.pycharm", iconClass: "devicon-pycharm-plain" },
  { id: "goland", name: "GoLand", appName: "GoLand", bundleId: "com.jetbrains.goland", iconClass: "devicon-goland-plain" },
  { id: "clion", name: "CLion", appName: "CLion", bundleId: "com.jetbrains.CLion", iconClass: "devicon-clion-plain" },
  { id: "phpstorm", name: "PhpStorm", appName: "PhpStorm", bundleId: "com.jetbrains.PhpStorm", iconClass: "devicon-phpstorm-plain" },
  { id: "rubymine", name: "RubyMine", appName: "RubyMine", bundleId: "com.jetbrains.RubyMine", iconClass: "devicon-rubymine-plain" },
  { id: "android-studio", name: "Android Studio", appName: "Android Studio", bundleId: "com.google.android.studio", iconClass: "devicon-androidstudio-plain" },
  { id: "xcode", name: "Xcode", appName: "Xcode", bundleId: "com.apple.dt.Xcode", iconClass: "devicon-xcode-plain" },
  { id: "sublime", name: "Sublime Text", appName: "Sublime Text", bundleId: "com.sublimetext.4", iconClass: "devicon-sublime-plain" },
]

export async function getInstalledIdes() {
  return getInstalledApps(ideCandidates)
}

export async function openInIde(ideId: string, targetPath: string) {
  return openInstalledApp(await getInstalledIdes(), ideId, targetPath, "IDE")
}
