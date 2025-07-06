import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
} from "../ui/pagination";
import { Scorecard } from "@/types/scorecard";

interface RoundTablePaginationProps {
  page: number;
  setPage: (page: number) => void;
  scorecards: Scorecard[];
}
const RoundTablePagination = ({
  page,
  setPage,
  scorecards,
}: RoundTablePaginationProps) => {
  return (
    <div className="flex justify-between mt-4">
      <Pagination>
        <PaginationContent>
          {page > 0 && (
            <>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => {
                    setPage(page - 1);
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  onClick={() => {
                    setPage(page - 1);
                  }}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            </>
          )}
          <PaginationItem>
            <PaginationLink
              onClick={() => {
                setPage(page);
              }}
              isActive
            >
              {page + 1}
            </PaginationLink>
          </PaginationItem>

          {page * 20 + 20 < scorecards.length && (
            <>
              <PaginationItem>
                <PaginationLink
                  onClick={() => {
                    setPage(page + 1);
                  }}
                >
                  {page + 2}
                </PaginationLink>
              </PaginationItem>
              {page + 2 < scorecards.length / 20 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => {
                    setPage(page + 1);
                  }}
                />
              </PaginationItem>
            </>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default RoundTablePagination;
