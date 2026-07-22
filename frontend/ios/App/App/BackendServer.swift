import Foundation
import Network

class BackendServer {

    static let shared = BackendServer()

    private var process: Process?
    private let host = "127.0.0.1"
    private let port: UInt16 = 8080
    private let startupTimeout: TimeInterval = 10.0

    private init() {}

    func start(completion: @escaping () -> Void) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            do {
                let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
                let backendDir = appSupport.appendingPathComponent("backend")
                let dataDir = appSupport.appendingPathComponent("data")
                let staticDir = backendDir.appendingPathComponent("static")

                try FileManager.default.createDirectory(at: backendDir, withIntermediateDirectories: true)
                try FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)

                try self.copyBundleResource(named: "resonance-backend", to: backendDir)
                self.copyBundleDirectory(named: "static", to: backendDir)

                let backendBinary = backendDir.appendingPathComponent("resonance-backend")
                try FileManager.default.setAttributes(
                    [.posixPermissions: 0o755],
                    ofItemAtPath: backendBinary.path
                )

                let dbPath = dataDir.appendingPathComponent("resonance.db").path

                let process = Process()
                process.executableURL = backendBinary
                process.currentDirectoryURL = backendDir
                process.environment = [
                    "DATABASE_URL": "sqlite:\(dbPath)",
                    "HOST": self.host,
                    "PORT": "\(self.port)",
                    "STATIC_DIR": staticDir.path
                ]

                let pipe = Pipe()
                process.standardOutput = pipe
                process.standardError = pipe

                try process.run()
                self.process = process

                print("Backend process started (PID: \(process.processIdentifier))")

                if self.waitForServer(timeout: self.startupTimeout) {
                    print("Backend server ready on \(self.host):\(self.port)")
                    completion()
                } else {
                    print("Backend server failed to start within timeout")
                }
            } catch {
                print("Failed to start backend: \(error.localizedDescription)")
            }
        }
    }

    func stop() {
        process?.terminate()
        process = nil
    }

    private func copyBundleResource(named name: String, to directory: URL) throws {
        guard let bundlePath = Bundle.main.path(forResource: name, ofType: nil) else {
            print("Resource not found in bundle: \(name)")
            return
        }
        let destPath = directory.appendingPathComponent(name).path
        if !FileManager.default.fileExists(atPath: destPath) {
            try FileManager.default.copyItem(atPath: bundlePath, toPath: destPath)
        }
    }

    private func copyBundleDirectory(named name: String, to directory: URL) {
        guard let bundlePath = Bundle.main.path(forResource: name, ofType: nil) else {
            print("Directory not found in bundle: \(name)")
            return
        }
        let destDir = directory.appendingPathComponent(name)
        if !FileManager.default.fileExists(atPath: destDir.path) {
            do {
                try FileManager.default.copyItem(atPath: bundlePath, toPath: destDir.path)
            } catch {
                print("Failed to copy directory \(name): \(error)")
            }
        }
    }

    private func waitForServer(timeout: TimeInterval) -> Bool {
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < timeout {
            let socket = CFSocketCreateWithSocketPair(
                kCFAllocatorDefault,
                0, 0,
                nil
            )
            if let socket = socket {
                CFSocketInvalidate(socket)
                return true
            }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return false
    }
}
