import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { H3, Muted, P } from "@/components/ui/typography";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";

const CourseHandicapCalculationDisplay = () => {
  const {
    handicapIndex,
    setHandicapIndex,
    slope,
    setSlope,
    rating,
    setRating,
    par,
    setPar,
    setIsNineHoles,
    isNineHoles,
    setHolesPlayed,
    courseHandicapCalculation,
  } = useRoundCalculationContext();
  return (
    <section className="space-y-4">
      <div className="flex flex-row items-center">
        <H3>Course Handicap</H3>
      </div>
      <Muted>Enter 18 hole values</Muted>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:flex items-end">
        <div>
          <Label>Handicap Index</Label>
          <Input
            placeholder="Handicap Index"
            value={handicapIndex !== 0 ? handicapIndex : ""}
            type="number"
            onChange={(e) =>
              setHandicapIndex(Number.parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div>
          <Label>Slope</Label>
          <Input
            placeholder="Slope"
            value={slope !== 0 ? slope : ""}
            onChange={(e) => setSlope(Number.parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>Course Rating</Label>
          <Input
            placeholder="Course Rating"
            value={rating !== 0 ? rating : ""}
            type="number"
            onChange={(e) => {
              setRating(Number.parseFloat(e.target.value) || 0);
            }}
          />
        </div>
        <div>
          <Label>Par</Label>
          <Input
            placeholder="Par"
            value={par !== 0 ? par : ""}
            onChange={(e) => {
              try {
                setPar(Number(e.target.value) || 0);
              } catch {
                setPar(par);
              }
            }}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label>18 hole hcp</Label>
          <Switch
            id="holes"
            checked={isNineHoles}
            onCheckedChange={(e) => {
              setIsNineHoles(e);
              setHolesPlayed(e ? 9 : 18);
            }}
          />
          <Label>9 hole hcp</Label>
        </div>
      </div>
      <Muted className="mb-2">
        {isNineHoles ? (
          <span>
            Course Handicap 9 holes = handicap index &#247; 2 &times; (slope
            &#247; 113) + (course rating - par) &#247; 2
          </span>
        ) : (
          <span>
            Course Handicap 18 holes = handicap index &times; (slope &#247; 113)
            + (course rating - par)
          </span>
        )}
      </Muted>
      <div className="flex flex-row items-center mt-4">
        <P>Course Handicap =</P>
        <Muted className="mx-2">
          {handicapIndex} + ({slope} &#247; 113) + ({rating} - {par})
        </Muted>
        <P className="mt-0!">=</P>
        <u className="ml-2 text-primary font-bold">
          {Math.round(courseHandicapCalculation)}
        </u>
      </div>
    </section>
  );
};

export default CourseHandicapCalculationDisplay;
