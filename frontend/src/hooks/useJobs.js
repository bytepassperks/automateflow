import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useJobs(params = {}) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: async () => {
      const { data } = await api.get('/jobs', { params });
      return data;
    },
  });
}

export function useJob(id) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (job && (job.status === 'queued' || job.status === 'processing')) {
        return 3000;
      }
      return false;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobData) => {
      const { data } = await api.post('/jobs', jobData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId) => {
      const { data } = await api.post(`/jobs/${jobId}/cancel`);
      return data;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });
}

export function useHandoffComplete() {
  return useMutation({
    mutationFn: async (jobId) => {
      const { data } = await api.post(`/jobs/${jobId}/handoff-complete`);
      return data;
    },
  });
}
