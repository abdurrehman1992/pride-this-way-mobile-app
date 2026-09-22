import Foundation
import UserNotifications
import React

@objc(TourLocalNotification)
final class TourLocalNotification: NSObject, RCTBridgeModule {
  static func moduleName() -> String! {
    "TourLocalNotification"
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(requestPermission:rejecter:)
  func requestPermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock,
  ) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
      if let error {
        reject("LOCAL_NOTIFICATION_PERMISSION_FAILED", error.localizedDescription, error)
        return
      }
      resolve(granted)
    }
  }

  @objc(showNotification:body:resolver:rejecter:)
  func showNotification(
    _ title: String,
    body: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock,
  ) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default

    let request = UNNotificationRequest(
      identifier: "destination-ready",
      content: content,
      trigger: nil,
    )
    UNUserNotificationCenter.current().add(request) { error in
      if let error {
        reject("LOCAL_NOTIFICATION_FAILED", error.localizedDescription, error)
      } else {
        resolve(true)
      }
    }
  }
}
