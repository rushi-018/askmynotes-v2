/**
 * Tracks study activity per subject in localStorage.
 * Records: quiz generations, chat messages sent, voice chats.
 */

const STORAGE_KEY = 'askmynotes_study_activity';

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Record a study event for a subject. type: 'quiz' | 'chat' | 'voice' */
export function recordStudyEvent(subjectId, type = 'chat') {
  const data = getAll();
  if (!data[subjectId]) {
    data[subjectId] = { quizzes: 0, chats: 0, voices: 0, lastStudied: null };
  }
  if (type === 'quiz') data[subjectId].quizzes += 1;
  else if (type === 'voice') data[subjectId].voices += 1;
  else data[subjectId].chats += 1;
  data[subjectId].lastStudied = new Date().toISOString();
  save(data);
}

/** Get activity stats for a subject */
export function getSubjectActivity(subjectId) {
  const data = getAll();
  return data[subjectId] || { quizzes: 0, chats: 0, voices: 0, lastStudied: null };
}

/** Get activity for all subjects */
export function getAllActivity() {
  return getAll();
}
