// Watch E2E suite — driven by scripts/watch/run-watch-e2e.sh, which
// orchestrates phone-side Maestro steps between these tests. Each test is
// launched individually with -only-testing; they are NOT order-independent
// on their own.
//
// Pager layout since plan 013 (D5): page 0 = DISTANCE face, page 1 = SCORE
// face (crown grid when the round is detailed, single-score collapse
// otherwise), page 2 = scorecard, page 3 = round controls / finish. Next
// on the score face saves the hole, advances, and swipes back to the
// distance face — tests swipe down again for the next hole.
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

    /// Wait until a static text with `identifier` shows `label` (polling —
    /// snapshot pushes and page animations race the assertions).
    private func waitForLabel(
        _ app: XCUIApplication, id: String, label: String, seconds: TimeInterval = 10
    ) -> Bool {
        let element = app.staticTexts[id]
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if element.exists, element.label == label { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        return element.exists && element.label == label
    }

    /// Phase 1 (phone round active): the watch mirrors the phone's session,
    /// landing on the heads-down DISTANCE face.
    func testMirrorsPhoneStartedRound() {
        let app = launch()
        let holeTitle = app.staticTexts["distance-hole-title"]
        XCTAssertTrue(holeTitle.waitForExistence(timeout: timeout),
                      "Watch should show the distance face for the phone-started round")
        XCTAssertEqual(holeTitle.label, "HOLE 1")
        XCTAssertTrue(app.staticTexts["distance-total"].exists,
                      "Distance face should show the hole's total distance")
        attach(app, "mirror-phone-round-distance-face")

        // One swipe down is the score face.
        app.swipeUp()
        XCTAssertTrue(app.buttons["save-score"].waitForExistence(timeout: timeout)
                        || app.buttons["grid-next-hole"].waitForExistence(timeout: 2),
                      "Score face should be one swipe below the distance face")
        attach(app, "mirror-phone-round-score-face")
    }

    /// Phase 1b: score one hole on the watch (relays to the phone; the
    /// harness asserts the phone shows it afterwards). Next saves, advances,
    /// and swipes back to the distance face for the new hole.
    func testScoresOneHole() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout))
        app.swipeUp()
        let save = app.buttons["save-score"]
        XCTAssertTrue(save.waitForExistence(timeout: timeout))
        // Bump to par+1 so the phone-side assertion is unambiguous (5 on a
        // par 4 — a value the seed flow never enters).
        app.buttons["score-plus"].tap()
        save.tap()
        // Next → back on the distance face with the cursor advanced: proof
        // the SCORE_SET was accepted locally.
        XCTAssertTrue(waitForLabel(app, id: "distance-hole-title", label: "HOLE 2"),
                      "Saving should advance and return to the distance face")
        attach(app, "scored-hole-1")
    }

    /// Plan 013 D5: a DETAILED session collapses nothing — the score face
    /// is the 2×2 crown grid. Ends ON the grid (harness screenshots after).
    func testDetailedGridShows() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout),
                      "No active round mirrored")
        attach(app, "detailed-distance-face")
        app.swipeUp()
        let scoreTile = app.descendants(matching: .any)["grid-score"].firstMatch
        XCTAssertTrue(scoreTile.waitForExistence(timeout: timeout),
                      "Detailed round should show the 2×2 grid on the score face")
        XCTAssertTrue(app.descendants(matching: .any)["grid-putts"].firstMatch.exists)
        XCTAssertTrue(app.descendants(matching: .any)["grid-pen"].firstMatch.exists)
        let fairway = app.descendants(matching: .any)["grid-fairway"].firstMatch
        XCTAssertTrue(fairway.exists)
        // Focus putts (crown target moves), toggle fairway – → ✓.
        app.descendants(matching: .any)["grid-putts"].firstMatch.tap()
        fairway.tap()
        attach(app, "detailed-grid-focused")
    }

    /// Plan 013 D5: Next commits the hole and swipes back to the distance
    /// face for the advanced hole.
    func testDetailedGridNextAdvances() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout))
        let startLabel = app.staticTexts["distance-hole-title"].label
        app.swipeUp()
        let next = app.buttons["grid-next-hole"]
        XCTAssertTrue(next.waitForExistence(timeout: timeout))
        next.tap()
        // Back on the distance face, cursor advanced past where we started.
        let deadline = Date().addingTimeInterval(10)
        let title = app.staticTexts["distance-hole-title"]
        while Date() < deadline,
              !(title.exists && title.label != startLabel) {
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        XCTAssertTrue(title.exists, "Next should land back on the distance face")
        XCTAssertNotEqual(title.label, startLabel, "Next should advance the hole")
        attach(app, "detailed-after-next")
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
    /// SCORE face for that hole (no manual scroll-up).
    func testScorecardRowJumpsBackToHoleView() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout),
                      "No active round")

        // Down two pages: score → scorecard.
        app.swipeUp()
        app.swipeUp()
        let row = app.buttons["scorecard-hole-3"]
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        attach(app, "scorecard-page")
        row.tap()

        // Back on the score face, cursor moved to hole 3 — no swiping.
        XCTAssertTrue(waitForLabel(app, id: "hole-title", label: "HOLE 3"))
        attach(app, "jumped-to-hole-3")
    }

    /// Standalone: finish + submit whatever round is currently active and
    /// fully scored (used to close out a manually-scored round with proof).
    func testFinishAndSubmitCurrentRound() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout),
                      "No active round to submit")

        // Down three pages: score face → scorecard → round controls.
        app.swipeUp()
        app.swipeUp()
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
    /// one tap per hole; each Next returns to the distance face), finish,
    /// submit, land on home.
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

        // Phone starts the session and pushes the snapshot back — the round
        // opens on the distance face.
        XCTAssertTrue(app.staticTexts["distance-hole-title"].waitForExistence(timeout: timeout),
                      "Session snapshot should arrive from the phone")
        attach(app, "watch-started-round")

        // Scores-only round (watch starts don't opt into detail): the score
        // face is the single-score collapse. Each Next saves par and swipes
        // back to the distance face, so swipe down again per hole.
        let save = app.buttons["save-score"]
        for holeIndex in 1...18 {
            if !save.exists { app.swipeUp() }
            XCTAssertTrue(save.waitForExistence(timeout: timeout),
                          "Save button missing at hole \(holeIndex)")
            save.tap()
            // Give the save → advance → swipe-back animation a beat.
            RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        }
        attach(app, "all-holes-scored")

        // Saving the final score auto-flips to the finish page (tag 3);
        // swiping down (distance → score → scorecard → controls) is only
        // the fallback if the animation hasn't landed yet.
        let finish = app.buttons["finish-round"]
        var fallbackSwipes = 0
        while !finish.waitForExistence(timeout: 5), fallbackSwipes < 3 {
            app.swipeUp()
            fallbackSwipes += 1
        }
        XCTAssertTrue(finish.waitForExistence(timeout: timeout))
        finish.tap()

        let submit = app.buttons["submit-scorecard"]
        XCTAssertTrue(submit.waitForExistence(timeout: timeout))
        attach(app, "finish-screen")
        submit.tap()

        assertSummaryThenHome(app)
    }
}
