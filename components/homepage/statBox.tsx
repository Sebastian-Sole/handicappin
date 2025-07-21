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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors duration-300 min-h-[2.5rem] min-[423px]:min-h-0">
          {title}
        </CardTitle>
        <div className="ml-2 min-[400px]:block hidden">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1 transition-colors duration-300">
          {value}
        </div>
        <div className="flex items-center space-x-2 mb-2">
          <Badge
            className={`text-xs transition-colors duration-300 ${
              change === "improvement"
                ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-800 dark:hover:text-green-200"
                : change === "achievement"
                ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 hover:text-yellow-800 dark:hover:text-yellow-200"
                : change === "increase"
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-800 dark:hover:text-blue-200"
                : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            }
             `}
          >
            {change}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default StatBox;
