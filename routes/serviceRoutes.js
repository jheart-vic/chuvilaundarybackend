import { Router } from "express";
import { listServices } from "../controllers/serviceController.js";

// import { listPricings } from "../controllers/servicePricingController.js";


const router = Router();

router.get("/", listServices);
// router.post("/",requireAuth, listPricings); // placeholder for create service


export default router;
