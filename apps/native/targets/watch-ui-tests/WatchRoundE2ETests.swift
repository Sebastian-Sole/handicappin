// Watch E2E suite — driven by scripts/watch/run-watch-e2e.sh, which
// orchestrates phone-side Maestro steps between these tests. Each test is
// launched individually with -only-testing; they are NOT order-independent
// on their own.
//
// The test target is injected into the generated Xcode project by
// scripts/watch/add-watch-ui-tests-target.rb (re-run after prebuild).
import XCTest

private let timeout: TimeInterval = 20

final class WatchRoundE2ETests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launch()
        return app
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// Phase 1 (phone round active): the watch mirrors the phone's session.
    func testMirrorsPhoneStartedRound() {
        let app = launch()
        let holeTitle = app.staticTexts["hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout),
                      "Watch should show the hole screen for the phone-started round")
        XCTAssertEqual(holeTitle.label, "HOLE 1")
        attach(app, "mirror-phone-round")
    }

    /// Phase 1b: score one hole on the watch (relays to the phone; the
    /// harness asserts the phone shows it afterwards).
    func testScoresOneHole() {
        let app = launch()
        let save = app.buttons["save-score"]
        XCTAssertTrue(save.waitForExistence(timeout: timeout))
        // Bump to par+1 so the phone-side assertion is unambiguous (5 on a
        // par 4 — a value the seed flow never enters).
        app.buttons["score-plus"].tap()
        save.tap()
        // Auto-advance proves the SCORE_SET was accepted locally.
        let holeTitle = app.staticTexts["hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout))
        XCTAssertEqual(holeTitle.label, "HOLE 2")
        attach(app, "scored-hole-1")
    }

    /// Phase 2 (phone round discarded): the watch fell back to the HOME
    /// screen — index hero up top, stats delivered by the phone.
    func testShowsHomeAfterDiscard() {
        let app = launch()
        let index = app.staticTexts["home-index"]
        XCTAssertTrue(index.waitForExistence(timeout: timeout),
                      "Watch should land on the home index page after discard")
        attach(app, "home-index-page")

        // Crown-scroll: last round, then season (with the fallback start).
        app.swipeUp()
        let lastRound = app.descendants(matching: .any)["home-last-round"].firstMatch
        _ = lastRound.waitForExistence(timeout: 5)
        attach(app, "home-last-round-page")
        app.swipeUp()
        let start = app.buttons["start-from-watch"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout),
                      "Season page should offer the fallback start button")
        attach(app, "home-season-page")
    }

    /// Picking a hole on the scorecard page jumps straight back to the
    /// scoring page for that hole (no manual scroll-up).
    func testScorecardRowJumpsBackToHoleView() {
        let app = launch()
        let holeTitle = app.staticTexts["hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout), "No active round")

        // Down two pages: controls → scorecard.
        app.swipeUp()
        app.swipeUp()
        let row = app.buttons["scorecard-hole-3"]
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        attach(app, "scorecard-page")
        row.tap()

        // Back on the scoring page, cursor moved to hole 3 — no swiping.
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout))
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline, holeTitle.label != "HOLE 3" {
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        XCTAssertEqual(holeTitle.label, "HOLE 3")
        attach(app, "jumped-to-hole-3")
    }

    /// Standalone: finish + submit whatever round is currently active and
    /// fully scored (used to close out a manually-scored round with proof).
    func testFinishAndSubmitCurrentRound() {
        let app = launch()
        let holeTitle = app.staticTexts["hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout), "No active round to submit")

        app.swipeUp()
        let finish = app.buttons["finish-round"]
        XCTAssertTrue(finish.waitForExistence(timeout: timeout))
        finish.tap()

        let submit = app.buttons["submit-scorecard"]
        XCTAssertTrue(submit.waitForExistence(timeout: timeout))
        attach(app, "finish-screen")
        submit.tap()

        assertSummaryThenHome(app)
    }

    /// Post-submit contract: the summary card (score + differential, index
    /// explicitly "recalculating") holds ~6s, then the watch settles on the
    /// HOME screen.
    private func assertSummaryThenHome(_ app: XCUIApplication) {
        let summary = app.descendants(matching: .any)["round-summary"].firstMatch
        XCTAssertTrue(summary.waitForExistence(timeout: 30),
                      "Expected the post-round summary card after submit")
        attach(app, "round-summary")

        // The differential rides the submit reply, which races the snapshot
        // that presented the card — give it a beat (well inside the 6s
        // hold) and photograph it; absence is not a failure (a slow reply
        // just means the row never showed this run).
        if app.staticTexts["Differential"].waitForExistence(timeout: 3) {
            attach(app, "round-summary-differential")
        }

        let home = app.staticTexts["home-index"]
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline, !home.exists {
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }
        attach(app, "home-after-submit")
        XCTAssertTrue(home.exists, "Summary should dissolve into the home screen")
    }

    /// Phase 3: the whole round happens on the wrist — start (via the
    /// fallback entry behind the season page), score all 18 (default = par,
    /// one tap per hole), finish, submit, land on home.
    func testFullRoundFromWatch() {
        let app = launch()

        // Home → season page → fallback start flow.
        let index = app.staticTexts["home-index"]
        XCTAssertTrue(index.waitForExistence(timeout: timeout))
        app.swipeUp()
        app.swipeUp()
        let start = app.buttons["start-from-watch"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        start.tap()

        let course = app.buttons["course-option"].firstMatch
        XCTAssertTrue(course.waitForExistence(timeout: timeout))
        course.tap()

        let tee = app.buttons["tee-option"].firstMatch
        XCTAssertTrue(tee.waitForExistence(timeout: timeout))
        tee.tap()

        let start18 = app.buttons["start-18"]
        XCTAssertTrue(start18.waitForExistence(timeout: timeout))
        start18.tap()

        // Phone starts the session and pushes the snapshot back.
        let holeTitle = app.staticTexts["hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout),
                      "Session snapshot should arrive from the phone")
        attach(app, "watch-started-round")

        let save = app.buttons["save-score"]
        for holeIndex in 1...18 {
            XCTAssertTrue(save.waitForExistence(timeout: timeout),
                          "Save button missing at hole \(holeIndex)")
            save.tap()
        }
        attach(app, "all-holes-scored")

        // Saving the final score auto-flips to the finish page; swipe is
        // only the fallback if the animation hasn't landed yet.
        let finish = app.buttons["finish-round"]
        if !finish.waitForExistence(timeout: 5) {
            app.swipeUp()
            XCTAssertTrue(finish.waitForExistence(timeout: timeout))
        }
        finish.tap()

        let submit = app.buttons["submit-scorecard"]
        XCTAssertTrue(submit.waitForExistence(timeout: timeout))
        attach(app, "finish-screen")
        submit.tap()

        assertSummaryThenHome(app)
    }
}
