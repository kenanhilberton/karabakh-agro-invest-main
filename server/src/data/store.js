// Public surface of the data layer.
// Constants stay here (pure values); all data access now goes through
// the PostgreSQL repository (db/repository.js). Every data function is async.
export {
  APPLICATION_STAGES,
  NEXT_ACTIONS,
  PROJECT_TECHNOLOGIES,
  VALUE_CHAIN_STEPS,
  TECH_KEYS,
  VALUE_CHAIN_KEYS
} from './constants.js';

export { DISTRICTS } from './seed.js';

export {
  // users
  getUsers,
  listUsers,
  findUserByVoen,
  findUserById,
  insertUser,
  updateUserStatus,
  updateUserPassword,
  // lands
  listLands,
  getLand as findLand,
  findLandsByIds,
  insertLand,
  updateLand,
  setLandStatus,
  // competitions
  listCompetitions,
  getCompetition as findCompetition,
  activeCompetition,
  insertCompetition,
  updateCompetition,
  setCompetitionStatus,
  setCompetitionStage,
  countApplicationsByCompetition,
  // applications
  listApplications,
  countApplications,
  findApplication,
  findApplicationByCode,
  insertApplication,
  updateApplication,
  updateApplicationDocuments,
  // notifications
  insertNotification,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../db/repository.js';
