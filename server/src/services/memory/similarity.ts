import type { Incident, Memory } from '../../types/domain';

const words = (value: string): Set<string> => new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);

export interface MemoryMatch { memory: Memory; similarity: number; reason: string }

export function rankMemories(incident: Incident, memories: Memory[]): MemoryMatch[] {
  const incidentText = [incident.title, incident.description, incident.service, ...incident.symptoms].join(' ');
  const incidentWords = words(incidentText);
  return memories.map((memory) => {
    const memoryWords = words([memory.title, memory.content, memory.rootCause, ...memory.tags, ...memory.services].join(' '));
    const overlap = [...incidentWords].filter((word) => memoryWords.has(word));
    const sharedService = memory.services.some((service) => service.toLowerCase() === incident.service.toLowerCase());
    const serviceScore = sharedService ? 0.42 : 0;
    const keywordScore = incidentWords.size ? Math.min(overlap.length / Math.max(incidentWords.size, 1), 1) * 0.38 : 0;
    const symptomHits = incident.symptoms.filter((symptom) => {
      const symptomWords = [...words(symptom)];
      return symptomWords.length > 0 && symptomWords.filter((word) => memoryWords.has(word)).length / symptomWords.length >= 0.5;
    }).length;
    const symptomScore = incident.symptoms.length ? Math.min(symptomHits / incident.symptoms.length, 1) * 0.20 : 0;
    const score = Math.min(serviceScore + keywordScore + symptomScore, 0.99);
    const reason = sharedService && overlap.length
      ? `Same service and ${overlap.slice(0, 4).join(', ')} evidence overlap`
      : sharedService ? 'Same affected service' : `${overlap.length} shared evidence keywords`;
    return { memory, similarity: Math.round(score * 100), reason };
  }).filter((match) => match.similarity > 0).sort((left, right) =>
    right.similarity - left.similarity || Date.parse(right.memory.createdAt) - Date.parse(left.memory.createdAt),
  );
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}