import express from 'express';
import { employeeLogin } from '../controllers/employeeController';

const router = express.Router();

router.post('/login', employeeLogin);

export default router;