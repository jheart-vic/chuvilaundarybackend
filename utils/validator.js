import Joi from "joi";


// Admin registration
export const adminRegisterSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number must be digits only (10-15 digits)",
    }),
  fullName: Joi.string().min(3).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 3 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
  }),
  masterPassword: Joi.string().required().messages({
    "string.empty": "Master password is required",
  }),
});

// Admin login
export const adminLoginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number must be digits only (10-15 digits)",
    }),
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),
  masterPassword: Joi.string().optional(),
}).or("password", "masterPassword") // At least one must be provided
  .messages({
    "object.missing": "Either password or master password must be provided",
  });


// ✅ Register Schema
export const registerSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Full name is required",
    "string.min": "Full name must be at least 3 characters long",
    "string.max": "Full name must not exceed 100 characters",
  }),

  phone: Joi.string()
    .pattern(/^(\+234|0)[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Nigerian number (0XXXXXXXXXX or +234XXXXXXXXXX)",
      "any.required": "Phone number is required",
    }),

  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  }),

  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),

  referredBy: Joi.string().trim().optional().allow("", null).messages({
    "string.base": "InvitedBy must be a string",
  }),
});

// ✅ Login Schema
export const loginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^(\+234|0)[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Nigerian number",
      "any.required": "Phone is required",
    }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),
});

// ✅ Verify Phone Schema
export const verifyPhoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^(\+234|0)[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Nigerian number",
    }),
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base": "Code must be 6 digits",
      "any.required": "Verification code is required",
    }),
});

// ✅ Resend Verification Schema
export const resendCodeSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^(\+234|0)[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Nigerian number",
      "any.required": "Phone number is required",
    }),
});

// ✅ Reset Password Schema
export const resetPasswordSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^(\+234|0)[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Nigerian number",
    }),
  newPassword: Joi.string().min(6).required().messages({
    "string.empty": "New password is required",
    "string.min": "New password must be at least 6 characters long",
  }),
});

export const createOrderSchema = Joi.object({
  userPhone: Joi.string()
    .pattern(/^\+?\d{7,15}$/)
    .optional(),

  userName: Joi.string().min(1).max(200).optional(),

  serviceTier: Joi.string()
    .valid("STANDARD", "PREMIUM", "DELUXE")
    .optional(),

  items: Joi.array().items(
    Joi.object({
      serviceCode: Joi.string().required(),
      serviceName: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      price: Joi.number().min(0).optional(),
      unit: Joi.string().optional(),
      itemNotes: Joi.string().optional(),
      addOns: Joi.array().items(
        Joi.object({
          key: Joi.string().optional(),
          name: Joi.string().optional(),
          price: Joi.number().min(0).optional(),
        })
      ).optional(),
    })
  ).min(1).required(),

  pickup: Joi.object({
    date: Joi.date().required(),
    window: Joi.string().required(),
    address: Joi.object({
      line1: Joi.string().required(),
      line2: Joi.string().allow("", null).optional(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      landmark: Joi.string().optional(),
      zone: Joi.string().optional(),
    }).required(),
  }).required(),

  delivery: Joi.object({
    date: Joi.date().required(),
    window: Joi.string().required(),
    address: Joi.object({
      line1: Joi.string().required(),
      line2: Joi.string().allow("", null).optional(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      landmark: Joi.string().optional(),
      zone: Joi.string().optional(),
    }).required(),
  }).required(),

  couponCode: Joi.string()
    .trim()
    .uppercase()
    .optional(),

  notes: Joi.string().allow("", null).optional(),
});



export const applyCouponSchema = Joi.object({
  code: Joi.string().required(),
  subtotal: Joi.number().min(0).required()
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().required(),
  note: Joi.string().allow("", null).optional()
});

export const createEmployeeSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?\d{7,15}$/).required(),
  fullName: Joi.string().min(2).required()
});

export const createServiceSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().alphanum().min(2).max(50).required(),
  description: Joi.string().allow("", null).optional(),
  basePrice: Joi.number().min(0).required(),
  unit: Joi.string().valid("item", "kg", "bundle").required(),
  turnaroundHours: Joi.number().integer().min(1).optional(),
  addOns: Joi.array().items(Joi.object({
    key: Joi.string().optional(),
    name: Joi.string().required(),
    price: Joi.number().min(0).required()
  })).optional()
});


export const reviewSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 50 characters'
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating must be at most 5',
    'any.required': 'Rating is required'
  }),
  comment: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'Comment must not exceed 500 characters'
  }),
  order: Joi.string().optional()
});


export const saveAddressSchema = Joi.object({
  label: Joi.string().trim().default("Home"),

  line1: Joi.string().trim().required().messages({
    "string.base": "Line 1 must be a string",
    "any.required": "Line 1 (street address) is required"
  }),

  line2: Joi.string().trim().allow("", null),

  city: Joi.string().trim().required().messages({
    "string.base": "City must be a string",
    "any.required": "City is required"
  }),

  state: Joi.string().trim().required().messages({
    "string.base": "State must be a string",
    "any.required": "State is required"
  }),

  landmark: Joi.string().trim().allow("", null)
});


export const createCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().required().messages({
    "string.empty": "Coupon code is required",
  }),
  discountPercent: Joi.number().min(1).max(100).optional(),
  discountAmount: Joi.number().min(1).optional(),
  expiresAt: Joi.date().greater("now").optional(),
  minOrderValue: Joi.number().min(0).optional(),
  maxUses: Joi.number().integer().min(1).optional(),
}).or("discountPercent", "discountAmount")
  .messages({
    "object.missing": "Provide either discountPercent or discountAmount",
  });
