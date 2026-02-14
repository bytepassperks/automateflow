import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useTemplates(params = {}) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: async () => {
      const { data } = await api.get('/templates', { params });
      return data;
    },
  });
}

export function useTemplate(slug) {
  return useQuery({
    queryKey: ['template', slug],
    queryFn: async () => {
      const { data } = await api.get(`/templates/${slug}`);
      return data;
    },
    enabled: !!slug,
  });
}
