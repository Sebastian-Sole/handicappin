import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface TeePosition {
  name: string;
  scores: number[];
  handicaps: number[];
  courseRating: number;
  slopeRating: number;
}

interface AddTeeDialogContentProps {
  newTee: TeePosition;
  setNewTee: (newTee: TeePosition) => void;
}

const AddTeeDialogContent = ({
  newTee,
  setNewTee,
}: AddTeeDialogContentProps) => {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="newTeeName">Tee Name</Label>
        <Input
          id="newTeeName"
          value={newTee.name}
          onChange={(e) =>
            setNewTee((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g., RED"
        />
      </div>
      <div className="space-y-2">
        <Label>Distances (Yards)</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {newTee.scores.map((_, index) => (
            <div key={index} className="space-y-1">
              <Label htmlFor={`new-distance-${index}`}>Hole {index + 1}</Label>
              <Input
                id={`new-distance-${index}`}
                type="number"
                value={newTee.scores[index] || ""}
                onChange={(e) => {
                  const newScores = [...newTee.scores];
                  newScores[index] = parseInt(e.target.value) || 0;
                  setNewTee((prev) => ({ ...prev, scores: newScores }));
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Handicaps</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {newTee.handicaps.map((_, index) => (
            <div key={index} className="space-y-1">
              <Label htmlFor={`new-handicap-${index}`}>Hole {index + 1}</Label>
              <Input
                id={`new-handicap-${index}`}
                type="number"
                value={newTee.handicaps[index] || ""}
                onChange={(e) => {
                  const newHandicaps = [...newTee.handicaps];
                  newHandicaps[index] = parseInt(e.target.value) || 0;
                  setNewTee((prev) => ({ ...prev, handicaps: newHandicaps }));
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="newCourseRating">Course Rating</Label>
        <Input
          id="newCourseRating"
          type="number"
          step="0.1"
          value={newTee.courseRating}
          onChange={(e) =>
            setNewTee((prev) => ({
              ...prev,
              courseRating: parseFloat(e.target.value) || 0,
            }))
          }
          placeholder="e.g., 72.3"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newSlopeRating">Slope Rating</Label>
        <Input
          id="newSlopeRating"
          type="number"
          value={newTee.slopeRating}
          onChange={(e) =>
            setNewTee((prev) => ({
              ...prev,
              slopeRating: parseInt(e.target.value) || 0,
            }))
          }
          placeholder="e.g., 133"
        />
      </div>
    </div>
  );
};

export default AddTeeDialogContent;
