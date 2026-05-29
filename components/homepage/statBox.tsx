import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatBoxProps {
  title: string;
  value: string;
  change: string;
  description?: string;
  icon: React.ReactNode;
}

const StatBox = ({ title, value, change, description, icon }: StatBoxProps) => {
  return (
    <Card className="hover:shadow-md dark:hover:shadow-2xl transition-all duration-300 border-0 dark:bg-primary/20 backdrop-blur-sm hover:bg-background/75 dark:hover:bg-primary/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
        <CardTitle className="text-label-sm text-muted-foreground transition-colors duration-300 min-h-10 min-[423px]:min-h-0">
          {title}
        </CardTitle>
        <div className="ml-sm min-[400px]:block hidden">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-figure text-foreground mb-xs transition-colors duration-300">
          {value}
        </div>
        <div className="flex items-center space-x-sm mb-sm">
          <Badge
            className={`text-meta transition-colors duration-300 ${
              change === "improvement"
                ? "tint-success text-success hover:text-success"
                : change === "achievement"
                ? "tint-warning text-warning hover:text-warning"
                : change === "increase"
                ? "tint-info text-info hover:text-info"
                : "bg-muted text-muted-foreground border-muted hover:bg-muted hover:text-muted-foreground"
            }
             `}
          >
            {change}
          </Badge>
        </div>
        <p className="text-meta text-muted-foreground transition-colors duration-300">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default StatBox;
