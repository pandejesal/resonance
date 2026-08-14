import Foundation

class BackendServer {

    static let shared = BackendServer()

    private var serverThread: Thread?
    private let host = "127.0.0.1"
    private let port: UInt16 = 8080
    private let startupTimeout: TimeInterval = 10.0

    private init() {}

    func start(completion: @escaping () -> Void) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let backendDir = appSupport.appendingPathComponent("backend")
            let dataDir = appSupport.appendingPathComponent("data")
            let staticDir = backendDir.appendingPathComponent("static")

            do {
                try FileManager.default.createDirectory(at: backendDir, withIntermediateDirectories: true)
                try FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
            } catch {
                print("Failed to create directories: \(error)")
                return
            }

            let dbPath = dataDir.appendingPathComponent("resonance.db").path
            let databaseUrl = "sqlite:\(dbPath)"

            print("Starting backend server...")
            print("Database: \(databaseUrl)")
            print("Static: \(staticDir.path)")

            resonance_start(
                databaseUrl,
                self.host,
                self.port,
                staticDir.path
            )

            if self.waitForServer(timeout: self.startupTimeout) {
                print("Backend server ready on \(self.host):\(self.port)")
                completion()
            } else {
                print("Backend server failed to start within timeout")
            }
        }
    }

    func stop() {
        print("Stopping backend server")
    }

    private func waitForServer(timeout: TimeInterval) -> Bool {
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < timeout {
            let sock = socket(AF_INET, SOCK_STREAM, 0)
            if sock >= 0 {
                var addr = sockaddr_in()
                addr.sin_family = sa_family_t(AF_INET)
                addr.sin_port = port.bigEndian
                addr.sin_addr.s_addr = inet_addr(host)
                let result = withUnsafePointer(to: &addr) { ptr in
                    ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
                        connect(sock, sockPtr, socklen_t(MemoryLayout<sockaddr_in>.size))
                    }
                }
                close(sock)
                if result == 0 {
                    return true
                }
            }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return false
    }
}
