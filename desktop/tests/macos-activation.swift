import AppKit
import Foundation

let bundle = CommandLine.arguments[1]
var last = ""
func sample() {
  let apps = NSWorkspace.shared.runningApplications
    .filter { $0.bundleURL?.path == bundle }
    .map { ["pid": Int($0.processIdentifier), "policy": $0.activationPolicy.rawValue] }
    .sorted { $0["pid"]! < $1["pid"]! }
  let state = String(data: try! JSONSerialization.data(withJSONObject: apps, options: [.sortedKeys]), encoding: .utf8)!
  if state != last {
    let event: [String: Any] = ["time": Date().timeIntervalSince1970, "apps": apps]
    var data = try! JSONSerialization.data(withJSONObject: event, options: [.sortedKeys])
    data.append(10)
    FileHandle.standardOutput.write(data)
    last = state
  }
}
let center = NSWorkspace.shared.notificationCenter
for name in [NSWorkspace.didLaunchApplicationNotification, NSWorkspace.didTerminateApplicationNotification] {
  center.addObserver(forName: name, object: nil, queue: .main) { _ in sample() }
}
print("ready")
fflush(stdout)
while true {
  sample()
  RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.005))
}
