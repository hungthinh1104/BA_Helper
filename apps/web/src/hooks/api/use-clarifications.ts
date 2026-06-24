import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import {
  ClarificationListResponseSchema,
  CreateClarificationRequest,
  AnswerClarificationRequest,
  DismissClarificationRequest,
  ClarificationItemDtoSchema,
  ConvertClarificationResponseSchema,
} from '@ba-helper/contracts';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/api/query-keys';
import { useOptionalProjectId } from '@/lib/project-context';

export const clarificationKeys = {
  all: ['clarifications'] as const,
  list: (analysisId: string) => [...clarificationKeys.all, 'list', analysisId] as const,
};

export function useClarifications(analysisId: string) {
  return useQuery({
    queryKey: clarificationKeys.list(analysisId),
    queryFn: async () => {
      const data = await apiGet(`/api/v1/impact-analyses/${analysisId}/clarifications`);
      return ClarificationListResponseSchema.parse(data).items;
    },
    enabled: !!analysisId,
  });
}

export function useEnsureClarification(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: CreateClarificationRequest) => {
      const data = await apiPost(`/api/v1/impact-analyses/${analysisId}/clarifications`, req);
      return ClarificationItemDtoSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clarificationKeys.list(analysisId) });
    },
    onError: (error) => {
      toast.error('Failed to request clarification', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

export function useAnswerClarification(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; answer: string }) => {
      const req: AnswerClarificationRequest = { answer: params.answer };
      const data = await apiPatch(`/api/v1/clarifications/${params.id}/answer`, req);
      return ClarificationItemDtoSchema.parse(data);
    },
    onSuccess: () => {
      toast.success('Clarification item has been answered successfully.');
      queryClient.invalidateQueries({ queryKey: clarificationKeys.list(analysisId) });
    },
    onError: (error) => {
      toast.error('Failed to answer clarification', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

export function useDismissClarification(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; reason?: string }) => {
      const req: DismissClarificationRequest = { reason: params.reason };
      const data = await apiPatch(`/api/v1/clarifications/${params.id}/dismiss`, req);
      return ClarificationItemDtoSchema.parse(data);
    },
    onSuccess: () => {
      toast.success('Clarification item has been dismissed.');
      queryClient.invalidateQueries({ queryKey: clarificationKeys.list(analysisId) });
    },
    onError: (error) => {
      toast.error('Failed to dismiss clarification', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

export function useConvertClarification(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clarificationId: string) => {
      const data = await apiPost(`/api/v1/clarifications/${clarificationId}/convert-to-revision`, {});
      return ConvertClarificationResponseSchema.parse(data);
    },
    onSuccess: () => {
      toast.success('Clarification answer has been converted to a requirement revision.');
      // Invalidate both clarifications and requirements related queries
      queryClient.invalidateQueries({ queryKey: clarificationKeys.list(analysisId) });
      // Might want to invalidate requirements list/detail here if they exist in UI state
    },
    onError: (error) => {
      toast.error('Failed to convert clarification to requirement revision', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

export function useReviewClarifications(analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.reviewClarifications(analysisId),
    queryFn: async () => {
      const { reviewClarificationListResponseSchema } = await import("@ba-helper/contracts")
      return apiGet(
        `/api/v1/impact-analyses/${analysisId}/review-clarifications`,
        reviewClarificationListResponseSchema
      )
    },
    enabled: Boolean(analysisId),
  })
}

export function useCreateReviewClarification(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data }: { data: import("@ba-helper/contracts").ReviewClarificationCreateRequest }) => {
      const { reviewClarificationRequestSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/impact-analyses/${analysisId}/review-clarifications`,
        data,
        reviewClarificationRequestSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.reviewClarifications(analysisId),
      })
    },
  })
}

export function useAnswerReviewClarification(analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ clarificationId, data }: { clarificationId: string; data: { answer: string } }) => {
      const { reviewClarificationRequestSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/review-clarifications/${clarificationId}/answer`,
        data,
        reviewClarificationRequestSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.reviewClarifications(analysisId),
      })
    },
  })
}

export function useCreateDerivedAnalysisFromClarification(analysisId: string) {
  const queryClient = useQueryClient()
  const activeProjectId = useOptionalProjectId()

  return useMutation({
    mutationFn: async (clarificationId: string) => {
      const { impactAnalysisResponseSchema } = await import("@ba-helper/contracts")
      return apiPost(
        `/api/v1/review-clarifications/${clarificationId}/derived-analyses`,
        {},
        impactAnalysisResponseSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.reviewClarifications(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(activeProjectId ?? "__workspace-pending__"),
      })
    },
  })
}
