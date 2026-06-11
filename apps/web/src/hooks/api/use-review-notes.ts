import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateReviewNoteRequest, ReviewNoteResponse } from '@ba-helper/contracts';
import { apiGet, apiPost } from '@/lib/api-client';

export function useReviewNotes(analysisId: string) {
  return useQuery({
    queryKey: ['impact-analyses', analysisId, 'review-notes'],
    queryFn: async (): Promise<{ items: ReviewNoteResponse[] }> => {
      // Assuming apiGet returns the payload directly and handles errors
      return apiGet<{ items: ReviewNoteResponse[] }>(`/api/v1/impact-analyses/${analysisId}/review-notes`);
    },
    enabled: Boolean(analysisId),
  });
}

export function useSaveReviewNote(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: CreateReviewNoteRequest): Promise<ReviewNoteResponse> => {
      return apiPost<ReviewNoteResponse>(`/api/v1/impact-analyses/${analysisId}/review-notes`, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impact-analyses', analysisId, 'review-notes'] });
      // Invalidate review queue if necessary
      queryClient.invalidateQueries({ queryKey: ['impact-analyses', analysisId, 'review-queue'] });
    },
  });
}
