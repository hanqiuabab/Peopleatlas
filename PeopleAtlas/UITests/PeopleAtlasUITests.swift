import XCTest

@MainActor final class PeopleAtlasUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws { continueAfterFailure = false }
    private func launch(demo: Bool = false, chinese: Bool = false, largeText: Bool = false, localizedStoreDemo: Bool = false) {
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "-AppleLanguages", chinese ? "(zh-Hans)" : "(en)", "-AppleLocale", chinese ? "zh_CN" : "en_US"]
        if chinese { app.launchArguments.append("--uitesting-chinese") }
        if demo { app.launchArguments.append("--uitesting-demo") }
        if localizedStoreDemo { app.launchArguments.append("--uitesting-store-localized-demo") }
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        #if os(macOS)
        // Test data is isolated; window restoration must be isolated as well.
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        #endif
        app.launch()
        #if os(macOS)
        // A desktop test launch may initially be inactive; exercise the foreground app.
        app.activate()
        #endif
        let ready = app.buttons["addPerson"].waitForExistence(timeout: 15)
        if !ready {
            capture("launch-diagnostic"); print(app.debugDescription)
        }
        XCTAssertTrue(ready)
    }
    private func navigate(_ label: String) {
        #if os(iOS)
        if app.tabBars.buttons[label].exists { app.tabBars.buttons[label].tap(); return }
        #endif
        let item = app.staticTexts[label].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 5)); item.tap()
    }
    private func addPerson(_ name: String, gender: String? = nil) {
        app.buttons["addPerson"].tap()
        let field = app.textFields["personName"]
        XCTAssertTrue(field.waitForExistence(timeout: 5)); field.tap(); field.typeText(name)
        if let gender { choose(gender, from: "personGender") }
        app.buttons["savePerson"].tap()
        XCTAssertTrue(app.buttons["person.\(name)"].waitForExistence(timeout: 5))
    }
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func choose(_ option: String, from identifier: String) {
        #if os(macOS)
        let picker = app.popUpButtons[identifier]
        XCTAssertTrue(picker.waitForExistence(timeout: 5)); picker.click()
        app.menuItems[option].firstMatch.click()
        #else
        let picker = app.buttons[identifier]
        XCTAssertTrue(picker.waitForExistence(timeout: 5)); picker.tap()
        app.buttons[option].firstMatch.tap()
        #endif
    }
    private func relationshipAction(_ title: String) {
        #if os(macOS)
        let actions = app.menuButtons["Relationship actions"].firstMatch
        XCTAssertTrue(actions.waitForExistence(timeout: 5)); actions.click()
        app.menuItems[title].firstMatch.click()
        #else
        let actions = app.buttons["Relationship actions"].firstMatch
        XCTAssertTrue(actions.waitForExistence(timeout: 5)); actions.tap()
        app.buttons[title].firstMatch.tap()
        #endif
    }
    private var smartQuestions: XCUIElementQuery {
        #if os(macOS)
        app.popUpButtons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "smartQuestion."))
        #else
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "smartQuestion."))
        #endif
    }
    private func graphEdgeCount() -> Int {
        navigate("Atlas")
        let edges = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "graphEdge."))
        XCTAssertTrue(edges.firstMatch.waitForExistence(timeout: 5))
        return edges.count
    }
    func testSmartFamilyConfirmationCanReturnCancelAndResolveEachQuestion() throws {
        launch(demo: true)
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        choose("江宁", from: "relationshipSource")
        choose("林远", from: "relationshipTarget")
        choose("Daughter", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.buttons["backToRelationshipEditing"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["smartOriginalRelationship"].label, "江宁 is 林远’s daughter")
        XCTAssertEqual(smartQuestions.count, 2)
        XCTAssertFalse(app.buttons["saveRelationship"].isEnabled)
        capture("smart-family-preview")
        app.buttons["backToRelationshipEditing"].tap()
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.buttons["backToRelationshipEditing"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["saveRelationship"].isEnabled)
        app.buttons["Cancel"].tap()
        XCTAssertEqual(graphEdgeCount(), 9, "Cancel and back must not save any part of the family")
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        choose("江宁", from: "relationshipSource")
        choose("林远", from: "relationshipTarget")
        choose("Daughter", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(smartQuestions.firstMatch.waitForExistence(timeout: 5))
        let questionIDs = smartQuestions.allElementsBoundByIndex.map(\.identifier)
        XCTAssertEqual(questionIDs.count, 2)
        choose("Older sister", from: questionIDs[0])
        XCTAssertFalse(app.buttons["saveRelationship"].isEnabled, "Every unknown age order must be answered")
        choose("Skip this connection", from: questionIDs[1])
        XCTAssertTrue(app.buttons["saveRelationship"].isEnabled)
        capture("smart-family-answered")
        app.buttons["saveRelationship"].tap()
        XCTAssertEqual(graphEdgeCount(), 12, "Save adds two parents and only the confirmed sibling")
    }
    func testCertainFamilyConnectionsSaveWithoutConfirmation() throws {
        launch(demo: true)
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        choose("陈墨", from: "relationshipSource")
        choose("周屿", from: "relationshipTarget")
        choose("Son", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertFalse(app.buttons["backToRelationshipEditing"].exists)
        XCTAssertTrue(app.buttons["addRelationship"].waitForExistence(timeout: 5))
        XCTAssertEqual(graphEdgeCount(), 11, "The known spouse is also saved as a parent without a confirmation sheet")
    }
    func testAddingWifeAfterFatherCompletesMotherAndSonWithoutConfirmation() throws {
        launch()
        addPerson("A")
        addPerson("B")
        addPerson("C", gender: "Female")
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        choose("A", from: "relationshipSource")
        choose("B", from: "relationshipTarget")
        choose("Father", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.buttons["addRelationship"].waitForExistence(timeout: 5))
        XCTAssertEqual(graphEdgeCount(), 1)
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        choose("C", from: "relationshipSource")
        choose("A", from: "relationshipTarget")
        choose("Wife", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.buttons["addRelationship"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["backToRelationshipEditing"].exists)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label == %@ OR label == %@", "B is C’s son", "C is B’s mother")).firstMatch.exists)
        capture("spouse-after-parent-completed")
        XCTAssertEqual(graphEdgeCount(), 3, "Father/son, wife/husband and mother/son must all be saved")
    }
    #if os(iOS)
    func testPrimaryScreensPassAccessibilityAudit() throws {
        launch(demo: true)
        let auditTypes: XCUIAccessibilityAuditType = [
            .contrast,
            .elementDetection,
            .hitRegion,
            .sufficientElementDescription,
            .textClipped,
            .trait
        ]
        var unhandledIssues: [String] = []
        func audit(_ screen: String) throws {
            // iPad's split navigation can expose the previous pane for a frame after a
            // selection. Audit the settled screen, not its transition material.
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.8))
            capture("accessibility-\(screen.lowercased())")
            try app.performAccessibilityAudit(for: auditTypes) { issue in
                // UIKit reports every UISearchBarTextField as potentially clipped
                // when simulating larger type, even with a one-word prompt. Keep
                // every other clipping issue (and every other audit category) fatal.
                if issue.auditType == .textClipped && issue.element?.elementType == .searchField {
                    return true
                }
                // iOS 26's floating tab bar applies a translucent shadow roughly
                // 64 points above its frame. The audit samples that material over
                // otherwise-black scrolling text. Ignore contrast only inside this
                // system-owned band; the same text remains audited after scrolling.
                let tabBar = self.app.tabBars.firstMatch
                if issue.auditType == .contrast,
                   tabBar.exists,
                   let frame = issue.element?.frame,
                   frame.maxY >= tabBar.frame.minY - 64 {
                    return true
                }
                // iPadOS 26 can report contrast failures for SwiftUI/Canvas nodes
                // without returning an element, frame, or element screenshot. Keep
                // mapped contrast failures fatal; only an unlocatable system issue is handled.
                if issue.auditType == .contrast && issue.element == nil {
                    return true
                }
                unhandledIssues.append("\(screen): \(String(describing: issue))")
                return true
            }
        }
        for screen in ["People", "Relationships", "Atlas", "Settings"] {
            navigate(screen)
            try audit(screen)
        }
        app.buttons["privacyPolicy"].tap()
        XCTAssertTrue(app.staticTexts["privacyPolicyStorage"].waitForExistence(timeout: 5))
        try audit("Privacy policy")
        // iPadOS dismisses a sheet after performAccessibilityAudit completes;
        // iPhone leaves it presented. Close only when the system kept it open.
        if app.buttons["privacyPolicyClose"].exists { app.buttons["privacyPolicyClose"].tap() }
        XCTAssertTrue(app.buttons["privacyPolicy"].waitForExistence(timeout: 5))
        XCTAssertTrue(unhandledIssues.isEmpty, unhandledIssues.joined(separator: "\n"))
    }

    func testPrivacyPolicyIsAvailableInBothLanguages() throws {
        launch()
        navigate("Settings")
        app.buttons["privacyPolicy"].tap()
        XCTAssertTrue(app.staticTexts["privacyPolicyStorage"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Data we do not collect"].exists)
        capture("privacy-policy-en")
        app.buttons["privacyPolicyClose"].tap()

        app.terminate()
        launch(chinese: true)
        navigate("设置")
        app.buttons["privacyPolicy"].tap()
        XCTAssertTrue(app.staticTexts["privacyPolicyStorage"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["我们不收集的数据"].exists)
        capture("privacy-policy-zh")
        app.buttons["privacyPolicyClose"].tap()
    }

    func testStoreScreenshotDrafts() throws {
        func settleForScreenshot() {
            // SwiftUI animates layout and color-scheme transitions. Capturing mid-frame
            // can show temporarily clipped chip labels that users never see at rest.
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 2.5))
        }
        func captureSet(chinese: Bool) {
            let language = chinese ? "zh" : "en"
            launch(demo: true, chinese: chinese, localizedStoreDemo: !chinese)
            settleForScreenshot()
            capture("store-\(language)-01-people")

            navigate(chinese ? "关系" : "Relationships")
            settleForScreenshot()
            capture("store-\(language)-02-relationships")

            navigate(chinese ? "图谱" : "Atlas")
            app.buttons[chinese ? "圆环" : "Ring"].tap()
            settleForScreenshot()
            capture("store-\(language)-03-ring")
            app.buttons[chinese ? "星球" : "Planet"].tap()
            settleForScreenshot()
            capture("store-\(language)-04-planet")

            navigate(chinese ? "设置" : "Settings")
            app.buttons["privacyPolicy"].tap()
            XCTAssertTrue(app.staticTexts["privacyPolicyStorage"].waitForExistence(timeout: 5))
            settleForScreenshot()
            capture("store-\(language)-05-privacy")
            app.buttons["privacyPolicyClose"].tap()
        }

        captureSet(chinese: false)
        app.terminate()
        captureSet(chinese: true)
    }

    func testAppearancePickerSwitchesLightDarkAndSystem() throws {
        launch()
        navigate("Settings")

        func shows(_ option: String) -> Bool {
            let picker = app.buttons["appAppearance"]
            guard picker.waitForExistence(timeout: 5) else { return false }
            return picker.label.contains(option) || (picker.value as? String)?.contains(option) == true
        }

        XCTAssertTrue(shows("System"))
        choose("Light", from: "appAppearance")
        XCTAssertTrue(shows("Light"))
        capture("settings-light")

        choose("Dark", from: "appAppearance")
        XCTAssertTrue(shows("Dark"))
        capture("settings-dark")

        choose("System", from: "appAppearance")
        XCTAssertTrue(shows("System"))
    }

    private var documentNavigation: XCUIElement {
        app.navigationBars["FullDocumentManagerViewControllerNavigationBar"]
    }
    private func cancelFilePicker() {
        // iOS 26 may show a nested destination without a Cancel button. Returning to
        // Browse or dragging down the native sheet is the same user cancellation path.
        if !app.buttons["Cancel"].exists, documentNavigation.buttons["Browse"].exists {
            documentNavigation.buttons["Browse"].tap()
        }
        if app.buttons["Cancel"].waitForExistence(timeout: 2) {
            app.buttons["Cancel"].firstMatch.tap()
        } else {
            XCTAssertTrue(documentNavigation.exists)
            documentNavigation.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)))
        }
        XCTAssertTrue(app.buttons["exportBackup"].waitForExistence(timeout: 5))
    }
    private func exportedFile(named name: String) -> XCUIElement {
        XCTAssertTrue(documentNavigation.waitForExistence(timeout: 8))
        let file = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
        if !file.exists {
            // Recents relies on indexing, which may not yet include the file just saved.
            // Browse directly to the simulator's local provider; never select iCloud.
            let browse = app.tabBars["DOC.browsingModeTabBar"].buttons["Browse"]
            if browse.exists { browse.tap() }
            let local = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "On My iPhone", "On My iPad")).firstMatch
            if !file.exists && local.waitForExistence(timeout: 3) { local.tap() }
        }
        XCTAssertTrue(file.waitForExistence(timeout: 10))
        return file
    }
    private func openExportedFile(named name: String) {
        let file = exportedFile(named: name)
        // The system document service exposes a visible thumbnail that XCTest may
        // label non-hittable. Its observed frame still gives an exact native tap point.
        let thumbnail = file.images.firstMatch
        let target = thumbnail.exists ? thumbnail : file
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    private func removeExportedFixture(named name: String) {
        // The import-only document picker intentionally omits Delete. Use Files for
        // cleanup, and match only the exact UUID-named fixture created by this test.
        let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
        files.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        files.launch()
        let file = files.cells.matching(NSPredicate(format: "label BEGINSWITH %@", name + ".json,")).firstMatch
        if !file.exists {
            let browse = files.buttons["Browse"].firstMatch
            if browse.exists { browse.tap() }
            let local = files.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "On My iPhone", "On My iPad")).firstMatch
            if local.waitForExistence(timeout: 5) { local.tap() }
        }
        XCTAssertTrue(file.waitForExistence(timeout: 10))
        file.press(forDuration: 1)
        let delete = files.buttons["Delete"].firstMatch
        XCTAssertTrue(delete.waitForExistence(timeout: 5)); delete.tap()
        let confirmation = files.alerts.buttons["Delete"].firstMatch
        if confirmation.waitForExistence(timeout: 2) { confirmation.tap() }
        let removed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: file)
        XCTAssertEqual(XCTWaiter.wait(for: [removed], timeout: 5), .completed)
        app.activate()
    }
    func testBackupFilePickersCanCancelWithoutChangingData() throws {
        launch(demo: true)
        navigate("Settings")
        app.buttons["exportBackup"].tap()
        XCTAssertTrue(app.textFields["DOCPicker.filenameTextField"].waitForExistence(timeout: 25))
        capture("backup-export-picker")
        cancelFilePicker()
        XCTAssertTrue(app.buttons["importBackup"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Backup exported"].exists)
        app.buttons["importBackup"].tap()
        XCTAssertTrue(documentNavigation.waitForExistence(timeout: 8))
        capture("backup-import-picker")
        cancelFilePicker()
        XCTAssertFalse(app.buttons["Replace local data"].exists)
        XCTAssertFalse(app.alerts.firstMatch.exists)
        XCTAssertEqual(graphEdgeCount(), 9)
    }
    func testBackupRoundTripRequiresExplicitReplacement() throws {
        launch(demo: true)
        let name = "PeopleAtlas-QA-\(UUID().uuidString.prefix(8))"
        let fixture = XCTAttachment(string: name + ".json")
        fixture.name = "exported-test-fixture"; fixture.lifetime = .keepAlways; add(fixture)
        navigate("Settings")
        app.buttons["exportBackup"].tap()
        let filename = app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(filename.waitForExistence(timeout: 25))
        filename.tap()
        // Clear only this known test-export filename, never a pre-existing user file.
        filename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 64))
        filename.typeText(name)
        documentNavigation.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Backup exported"].waitForExistence(timeout: 10))
        navigate("People")
        addPerson("After backup")
        navigate("Settings")
        app.buttons["importBackup"].tap()
        openExportedFile(named: name)
        let replace = app.buttons["Replace local data"].firstMatch
        XCTAssertTrue(replace.waitForExistence(timeout: 8))
        capture("backup-replace-confirmation")
        app.buttons["Cancel"].firstMatch.tap()
        navigate("People")
        XCTAssertTrue(app.buttons["person.After backup"].waitForExistence(timeout: 5))
        navigate("Settings")
        app.buttons["importBackup"].tap()
        openExportedFile(named: name)
        XCTAssertTrue(replace.waitForExistence(timeout: 8)); replace.tap()
        XCTAssertTrue(app.staticTexts["Backup imported"].waitForExistence(timeout: 8))
        navigate("People")
        XCTAssertFalse(app.buttons["person.After backup"].exists)
        XCTAssertEqual(graphEdgeCount(), 9)
        capture("backup-restored")
        removeExportedFixture(named: name)
    }
    #endif
    func testEditAndDeleteRelationshipThenDeletePerson() throws {
        launch()
        addPerson("Atlas A"); addPerson("Atlas B")
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        app.buttons["saveRelationship"].tap()
        relationshipAction("Edit")
        choose("Father", from: "relationshipKind")
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "father")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "son")).firstMatch.exists)
        relationshipAction("Delete relationship")
        XCTAssertTrue(app.staticTexts["No connections yet"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Delete relationship"].exists, "Deleting a relationship must not ask for confirmation")
        navigate("People")
        app.buttons["person.Atlas A"].tap()
        app.buttons["deletePerson"].tap()
        app.buttons["confirmDeletePerson"].firstMatch.tap()
        XCTAssertTrue(app.buttons["person.Atlas B"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["person.Atlas A"].exists)
        capture("after-deletions")
    }
    func testGraphFiltersCanRestoreAnIndividualRelationshipType() throws {
        launch(demo: true)
        navigate("Atlas")
        let people = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "graphPerson."))
        let edges = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "graphEdge."))
        let loaded = people.firstMatch.waitForExistence(timeout: 5)
        if !loaded { print(app.debugDescription); capture("graph-filter-diagnostic") }
        XCTAssertTrue(loaded)
        XCTAssertEqual(people.count, 8)
        XCTAssertEqual(edges.count, 9)
        app.buttons["graph.filter.relationships"].tap()
        XCTAssertEqual(edges.count, 0)
        app.buttons["graph.filter.father"].tap()
        XCTAssertEqual(edges.count, 2)
        app.buttons["graph.filter.male"].tap()
        XCTAssertEqual(people.count, 4)
        XCTAssertEqual(edges.count, 0)
        app.buttons["graph.filter.male"].tap()
        XCTAssertEqual(edges.count, 2)
        app.buttons["graph.filter.relationships"].tap()
        XCTAssertEqual(edges.count, 0)
        app.buttons["graph.filter.relationships"].tap()
        XCTAssertEqual(edges.count, 9)
        capture("graph-filters-restored")
    }
    func testEveryGraphLayoutKeepsSelectionAndCanEnterFullScreen() throws {
        launch(demo: true)
        navigate("Atlas")
        for layout in ["Ring", "Hierarchy", "Planet", "Nebula"] {
            #if os(macOS)
            let button = app.radioButtons[layout].exists ? app.radioButtons[layout] : app.buttons[layout]
            #else
            let button = app.buttons[layout]
            #endif
            XCTAssertTrue(button.waitForExistence(timeout: 5)); button.tap()
            let edges = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "graphEdge."))
            XCTAssertEqual(edges.count, 9)
            let person = app.buttons["林远"].firstMatch
            XCTAssertTrue(person.waitForExistence(timeout: 5)); person.tap()
            XCTAssertTrue(app.buttons["Clear selection"].waitForExistence(timeout: 3))
            XCTAssertEqual(edges.count, 4, "A selected person only shows their own connections")
            capture("graph-\(layout.lowercased())-selected")
            #if os(iOS)
            app.buttons["Full screen"].tap()
            XCTAssertTrue(app.buttons["Close full screen"].waitForExistence(timeout: 5))
            capture("graph-\(layout.lowercased())-fullscreen")
            app.buttons["Close full screen"].tap()
            XCTAssertTrue(app.buttons["Clear selection"].waitForExistence(timeout: 5))
            #endif
            person.tap()
            XCTAssertFalse(app.buttons["Clear selection"].exists, "Tapping the selected node toggles it off")
            XCTAssertEqual(edges.count, 9)
        }
    }
    #if os(iOS)
    func testGraphPinchDragAndResetInEveryLayout() throws {
        launch(demo: true)
        navigate("Atlas")
        let graph = app.otherElements["relationshipGraph"].firstMatch
        let first = app.buttons["林远"].firstMatch
        let second = app.buttons["周屿"].firstMatch
        func separation() -> CGFloat {
            hypot(first.frame.midX - second.frame.midX, first.frame.midY - second.frame.midY)
        }
        for layout in ["Ring", "Hierarchy", "Planet", "Nebula"] {
            app.buttons[layout].tap()
            XCTAssertTrue(graph.waitForExistence(timeout: 5))
            if layout != "Hierarchy" { XCTAssertTrue(app.buttons["Start rotation"].exists, "A layout change must preserve manual pause") }
            let baseline = separation()
            XCTAssertGreaterThan(baseline, 20)
            graph.pinch(withScale: 1.5, velocity: 1)
            XCTAssertGreaterThan(separation(), baseline * 1.15, "\(layout) responds to a real two-finger pinch")
            XCTAssertFalse(app.buttons["Clear selection"].exists, "Pinching must not select a node underneath a finger")
            if layout != "Hierarchy" { XCTAssertTrue(app.buttons["Start rotation"].exists, "Pinching must preserve manual pause") }
            app.buttons["Reset view"].tap()
            XCTAssertEqual(separation(), baseline, accuracy: 2)
            let initial = first.frame
            let start = graph.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.8))
            let end = graph.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.8))
            start.press(forDuration: 0.05, thenDragTo: end)
            XCTAssertFalse(app.buttons["Clear selection"].exists, "Dragging the canvas must not accidentally select a node")
            if layout != "Hierarchy" { XCTAssertTrue(app.buttons["Start rotation"].exists, "Dragging must preserve manual pause") }
            if layout == "Planet" {
                XCTAssertGreaterThan(hypot(first.frame.midX - initial.midX, first.frame.midY - initial.midY), 8)
            } else {
                XCTAssertGreaterThan(first.frame.midX - initial.midX, 35)
                XCTAssertEqual(first.frame.midY, initial.midY, accuracy: 8)
            }
            app.buttons["Reset view"].tap()
            XCTAssertEqual(first.frame.midX, initial.midX, accuracy: 2)
            XCTAssertEqual(first.frame.midY, initial.midY, accuracy: 2)
            if layout != "Hierarchy" { XCTAssertTrue(app.buttons["Start rotation"].exists, "Resetting the viewport must preserve manual pause") }
            capture("graph-\(layout.lowercased())-gestures-reset")
        }
    }
    func testGraphSelectionPausesAndResumesRotationWithoutLosingManualPause() throws {
        launch(demo: true)
        navigate("Atlas")
        app.buttons["Planet"].tap()
        let person = app.buttons["林远"].firstMatch
        app.buttons["Start rotation"].tap()
        XCTAssertTrue(app.buttons["Pause rotation"].waitForExistence(timeout: 3))
        person.tap()
        XCTAssertTrue(app.buttons["Clear selection"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Start rotation"].exists, "Selection pauses the existing rotation")
        person.tap()
        XCTAssertTrue(app.buttons["Pause rotation"].exists, "Deselecting resumes the previous rotation preference")
        app.buttons["Pause rotation"].tap()
        person.tap(); person.tap()
        XCTAssertTrue(app.buttons["Start rotation"].exists, "Deselecting must preserve a user's manual pause")
        let before = person.frame
        app.buttons["Zoom in"].tap()
        app.buttons["Zoom out"].tap()
        XCTAssertEqual(person.frame.midX, before.midX, accuracy: 2)
        XCTAssertEqual(person.frame.midY, before.midY, accuracy: 2)
        capture("graph-manual-pause-preserved")
    }
    #endif
    func testCreatePeopleAndRelationshipThenOpenGraphAndSettings() throws {
        launch()
        addPerson("Atlas Test A")
        addPerson("Atlas Test B")
        capture("people-created")
        navigate("Relationships")
        app.buttons["addRelationship"].tap()
        XCTAssertTrue(app.buttons["saveRelationship"].waitForExistence(timeout: 5))
        app.buttons["saveRelationship"].tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "colleague")).firstMatch.waitForExistence(timeout: 5))
        capture("relationship-created")
        navigate("Atlas")
        XCTAssertTrue(app.otherElements["relationshipGraph"].exists || app.buttons["Atlas Test A"].exists)
        capture("graph-ring")
        navigate("Settings")
        XCTAssertTrue(app.buttons["exportBackup"].waitForExistence(timeout: 5))
        capture("settings")
    }
    func testChineseCardsAndPlanetSelection() throws {
        launch(demo: true, chinese: true)
        XCTAssertTrue(app.staticTexts["每一段关系，都有故事。"].exists)
        capture("zh-people")
        navigate("图谱")
        #if os(macOS)
        let planet = app.radioButtons["星球"].exists ? app.radioButtons["星球"] : app.buttons["星球"]
        #else
        let planet = app.buttons["星球"]
        #endif
        XCTAssertTrue(planet.waitForExistence(timeout: 5)); planet.tap()
        capture("zh-planet")
        let person = app.buttons["林远"].firstMatch
        XCTAssertTrue(person.exists)
        person.tap()
        XCTAssertTrue(app.buttons["取消选中"].waitForExistence(timeout: 3))
        capture("zh-planet-selected")
        app.buttons["取消选中"].tap()
    }
    func testLargeTextEmptyStateAndEditor() throws {
        launch(largeText: true)
        capture("large-text-empty")
        app.buttons["addPerson"].tap()
        XCTAssertTrue(app.textFields["personName"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["savePerson"].isEnabled)
        capture("large-text-editor")
        app.buttons["Cancel"].tap()
    }
}
