import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface TooltipIconProps {
  children: React.ReactNode;
  className?: string;
}

const TooltipIcon = ({ children, className }: TooltipIconProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {" "}
          <InfoIcon
            className={`h-6 w-6 text-muted-foreground ml-4 ${className}`}
          />{" "}
        </TooltipTrigger>
        <TooltipContent>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TooltipIcon;
