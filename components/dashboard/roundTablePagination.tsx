import { RoundWithCourseAndTee } from "@/types/database";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
} from "../ui/pagination";

interface RoundTablePaginationProps {
  page: number;
  setPage: (page: number) => void;
  roundsList: RoundWithCourseAndTee[];
}
const RoundTablePagination = ({
  page,
  setPage,
  roundsList,
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

          {page * 20 + 20 < roundsList.length && (
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
              {page + 2 < roundsList.length / 20 && (
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
