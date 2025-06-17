const express = require('express');
const {
  getAllInterests,
  createInterest,
  updateInterest,
  getPriorityDocuments,
  getPriorityUsers,
  getMyInterests,
  getPriorityGroups,
  getRecommendedDocsUsersGroups,
} = require('../controllers/interest.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', protectRoute, createInterest);
router.get('/', getAllInterests);
router.get('/my-interests', protectRoute, getMyInterests);

router.get('/priority-documents', protectRoute, getPriorityDocuments);
router.get('/priority-users', protectRoute, getPriorityUsers);
router.get('/priority-groups', protectRoute, getPriorityGroups);
router.get('/recommended', protectRoute, getRecommendedDocsUsersGroups);

router.put('/:id', protectRoute, updateInterest);

module.exports = router;
