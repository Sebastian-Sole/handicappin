"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/statistics/format-utils";

interface FunComparisonsCardProps {
  totalStrokes: number;
  totalHoles: number;
  golfAgeDays: number;
  totalDistancePlayed?: number;
  uniqueCourses?: number;
}

interface Comparison {
  emoji: string;
  text: string;
  category: "effort" | "journey" | "achievement" | "fun";
}

function generateComparisons(
  totalStrokes: number,
  totalHoles: number,
  golfAgeDays: number,
  totalDistancePlayed: number,
  uniqueCourses: number
): Comparison[] {
  const comparisons: Comparison[] = [];

  // Distance-based comparisons
  if (totalDistancePlayed > 0) {
    const miles = totalDistancePlayed / 1760;
    const marathons = miles / 26.2;

    if (marathons >= 1) {
      comparisons.push({
        emoji: "🏃",
        category: "effort",
        text: `You've played ${marathons.toFixed(1)} marathon${marathons >= 2 ? "s" : ""} worth of golf holes (${miles.toFixed(0)} miles)`,
      });
    } else if (miles >= 1) {
      comparisons.push({
        emoji: "📏",
        category: "effort",
        text: `The total length of all holes you've played is ${miles.toFixed(1)} miles`,
      });
    }

    // Empire State Building (1,454 ft = ~485 yards)
    const empireStateBuildings = totalDistancePlayed / 485;
    if (empireStateBuildings >= 10) {
      comparisons.push({
        emoji: "🏙️",
        category: "fun",
        text: `Laid end-to-end, your golf holes would reach ${Math.floor(empireStateBuildings)} Empire State Buildings tall`,
      });
    }
  }

  // Stride-based comparisons (average stride ~0.75m or 2.5ft)
  const stepsAsMeters = totalStrokes * 0.75;
  const stepsAsMiles = (totalStrokes * 2.5) / 5280;

  if (stepsAsMiles >= 1) {
    comparisons.push({
      emoji: "🚶",
      category: "effort",
      text: `If each swing was a step, you'd have walked ${stepsAsMiles.toFixed(1)} miles`,
    });
  }

  // Time-based comparisons (average swing ~3 seconds)
  const swingTimeSeconds = totalStrokes * 3;
  const swingTimeHours = swingTimeSeconds / 3600;
  const swingTimeMovies = swingTimeHours / 2; // Average movie ~2 hours

  if (swingTimeMovies >= 1) {
    comparisons.push({
      emoji: "🎬",
      category: "fun",
      text: `Time spent swinging equals ${swingTimeMovies.toFixed(1)} movies (${swingTimeHours.toFixed(1)} hours)`,
    });
  } else if (swingTimeHours >= 1) {
    comparisons.push({
      emoji: "⏱️",
      category: "effort",
      text: `You've spent ${swingTimeHours.toFixed(1)} hours just swinging the club`,
    });
  }

  // Ball-based comparisons (golf ball weighs ~45g)
  const ballWeight = totalStrokes * 45; // grams
  const ballWeightLbs = (ballWeight / 1000) * 2.205;
  const bowlingBalls = ballWeightLbs / 14; // Average bowling ball ~14 lbs

  if (bowlingBalls >= 1) {
    comparisons.push({
      emoji: "🎳",
      category: "fun",
      text: `You've struck the equivalent weight of ${bowlingBalls.toFixed(1)} bowling balls`,
    });
  } else if (ballWeightLbs >= 10) {
    comparisons.push({
      emoji: "⚖️",
      category: "fun",
      text: `You've struck ${ballWeightLbs.toFixed(0)} lbs worth of golf balls`,
    });
  }

  // Calorie comparisons (average golf round burns ~1,400 calories for 18 holes)
  const fullRounds = totalHoles / 18;
  const caloriesBurned = fullRounds * 1400;
  const pizzaSlices = Math.floor(caloriesBurned / 285); // ~285 cal per slice
  const bigMacs = Math.floor(caloriesBurned / 563); // ~563 cal per Big Mac
  const donuts = Math.floor(caloriesBurned / 250); // ~250 cal per donut

  if (bigMacs >= 5) {
    comparisons.push({
      emoji: "🍔",
      category: "fun",
      text: `Your golf has burned enough calories for ${bigMacs} Big Macs`,
    });
  } else if (pizzaSlices >= 5) {
    comparisons.push({
      emoji: "🍕",
      category: "fun",
      text: `Your golf has burned enough calories for ${pizzaSlices} pizza slices`,
    });
  } else if (donuts >= 3) {
    comparisons.push({
      emoji: "🍩",
      category: "fun",
      text: `Your golf has burned enough calories for ${donuts} donuts`,
    });
  }

  // Hole completion comparisons
  const completeRounds = Math.floor(totalHoles / 18);
  if (completeRounds >= 50) {
    comparisons.push({
      emoji: "🏌️",
      category: "achievement",
      text: `You've completed the equivalent of ${completeRounds} full 18-hole rounds`,
    });
  } else if (completeRounds >= 10) {
    comparisons.push({
      emoji: "🏌️",
      category: "achievement",
      text: `You've completed ${completeRounds} full 18-hole rounds' worth of golf`,
    });
  }

  // Golf journey comparisons
  if (golfAgeDays >= 365) {
    const years = golfAgeDays / 365;
    if (years >= 2) {
      comparisons.push({
        emoji: "📅",
        category: "journey",
        text: `Your golf journey has been ${years.toFixed(1)} years in the making`,
      });
    } else {
      comparisons.push({
        emoji: "🎂",
        category: "journey",
        text: `Your golf journey is over a year old!`,
      });
    }
  } else if (golfAgeDays >= 30) {
    const months = Math.floor(golfAgeDays / 30);
    comparisons.push({
      emoji: "📅",
      category: "journey",
      text: `Your golf journey started ${months} month${months > 1 ? "s" : ""} ago`,
    });
  }

  // Course exploration comparisons
  if (uniqueCourses >= 20) {
    comparisons.push({
      emoji: "🗺️",
      category: "achievement",
      text: `You're a true course explorer with ${uniqueCourses} different courses played!`,
    });
  } else if (uniqueCourses >= 10) {
    comparisons.push({
      emoji: "🧭",
      category: "journey",
      text: `You've explored ${uniqueCourses} unique golf courses`,
    });
  }

  // Fun milestone comparisons
  if (totalStrokes >= 50000) {
    comparisons.push({
      emoji: "👑",
      category: "achievement",
      text: `You're a Golf Legend with 50,000+ strokes!`,
    });
  } else if (totalStrokes >= 25000) {
    comparisons.push({
      emoji: "🏆",
      category: "achievement",
      text: `You've joined the elite 25,000+ stroke club!`,
    });
  } else if (totalStrokes >= 10000) {
    comparisons.push({
      emoji: "🎊",
      category: "achievement",
      text: `You've joined the 10,000+ stroke club!`,
    });
  } else if (totalStrokes >= 5000) {
    comparisons.push({
      emoji: "🌟",
      category: "achievement",
      text: `You're over halfway to the 10,000 stroke milestone!`,
    });
  } else if (totalStrokes >= 1000) {
    comparisons.push({
      emoji: "🎯",
      category: "achievement",
      text: `You've crossed the 1,000 stroke mark!`,
    });
  }

  // Strokes per day (commitment level)
  if (golfAgeDays > 0) {
    const strokesPerDay = totalStrokes / golfAgeDays;
    if (strokesPerDay >= 10) {
      comparisons.push({
        emoji: "💪",
        category: "effort",
        text: `You average ${strokesPerDay.toFixed(1)} strokes per day since you started!`,
      });
    }
  }

  // Golf balls potentially lost (average golfer loses 2 balls per round)
  const estimatedBallsLost = Math.floor(fullRounds * 2);
  if (estimatedBallsLost >= 20) {
    comparisons.push({
      emoji: "🔍",
      category: "fun",
      text: `Statistically, you may have lost around ${estimatedBallsLost} golf balls`,
    });
  }

  // Randomize and return max 6 comparisons for variety
  const shuffled = comparisons.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
}

export function FunComparisonsCard({
  totalStrokes,
  totalHoles,
  golfAgeDays,
  totalDistancePlayed = 0,
  uniqueCourses = 0,
}: FunComparisonsCardProps) {
  const comparisons = generateComparisons(
    totalStrokes,
    totalHoles,
    golfAgeDays,
    totalDistancePlayed,
    uniqueCourses
  );

  if (comparisons.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p className="text-4xl mb-2">🏌️</p>
          <p>Play more rounds to unlock fun comparisons!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span>🎪</span> Fun Facts About Your Game
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {comparisons.map((comparison, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <span className="text-2xl flex-shrink-0">{comparison.emoji}</span>
              <p className="text-sm">{comparison.text}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Based on {formatNumber(totalStrokes)} total strokes across{" "}
          {formatNumber(totalHoles)} holes
        </p>
      </CardContent>
    </Card>
  );
}
