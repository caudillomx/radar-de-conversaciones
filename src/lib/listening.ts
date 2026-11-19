import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as fn from "./listening.functions";

export const studiesQuery = () => queryOptions({ queryKey: ["studies"], queryFn: () => fn.listStudies() });
export const studyQuery = (id: string) => queryOptions({ queryKey: ["study", id], queryFn: () => fn.getStudy({ data: { id } }) });
export const COMMENTS_PAGE = 25;
export const commentsQuery = (studyId: string, sourceId: string | null, page = 0) =>
  queryOptions({ queryKey: ["comments", studyId, sourceId, page], queryFn: () => fn.listComments({ data: { studyId, sourceId, limit: COMMENTS_PAGE, offset: page * COMMENTS_PAGE } }), placeholderData: (prev) => prev });

export type StudyDetail = NonNullable<Awaited<ReturnType<typeof fn.getStudy>>>;
export type SourceRow = StudyDetail["sources"][number];

export function useListeningMutation<A>(serverFn: (a: { data: A }) => Promise<unknown>, studyId?: string) {
  const qc = useQueryClient();
  const call = useServerFn(serverFn as never) as unknown as (a: { data: A }) => Promise<unknown>;
  return useMutation({
    mutationFn: (data: A) => call({ data }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["studies"] });
      if (studyId) { qc.invalidateQueries({ queryKey: ["study", studyId] }); qc.invalidateQueries({ queryKey: ["comments", studyId] }); }
    },
  });
}
export { fn };

export const analysisQuery = (studyId: string) => queryOptions({ queryKey: ["analysis", studyId], queryFn: () => fn.getLatestAnalysis({ data: { studyId } }) });
export type AnalysisRow = NonNullable<Awaited<ReturnType<typeof fn.getLatestAnalysis>>>;
