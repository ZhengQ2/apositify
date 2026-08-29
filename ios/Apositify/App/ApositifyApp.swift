import SwiftUI

@main
struct ApositifyApp: App {
    @StateObject private var registers = RegisterStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(registers)
                .tint(Color("BrandBlue"))
        }
    }
}
