import type {
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
  GetSubscriptionResponse,
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
  ErrorResponse,
  ApiResult,
} from "./stripe-types";

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<TResponse>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    // Handle rate limiting (429)
    if (response.status === 429) {
      return {
        success: false,
        error: {
          error: data.error || "Too many requests",
          retryAfter: data.retryAfter,
        },
      };
    }

    // Handle other errors
    if (!response.ok) {
      return {
        success: false,
        error: {
          error: data.error || "Request failed",
          details: data.details,
        },
      };
    }

    // Success
    return {
      success: true,
      data: data as TResponse,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        error: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

/**
 * Create a checkout session
 */
export async function createCheckout(
  request: CheckoutRequest
): Promise<ApiResult<CheckoutResponse>> {
  return apiFetch<CheckoutResponse>("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Create a customer portal session
 */
export async function createPortal(): Promise<ApiResult<PortalResponse>> {
  return apiFetch<PortalResponse>("/api/stripe/portal", {
    method: "POST",
  });
}

/**
 * Get subscription information
 */
export async function getSubscription(): Promise<ApiResult<GetSubscriptionResponse>> {
  return apiFetch<GetSubscriptionResponse>("/api/stripe/subscription", {
    method: "GET",
  });
}

/**
 * Update subscription plan
 */
export async function updateSubscription(
  request: UpdateSubscriptionRequest
): Promise<ApiResult<UpdateSubscriptionResponse>> {
  return apiFetch<UpdateSubscriptionResponse>("/api/stripe/subscription", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
