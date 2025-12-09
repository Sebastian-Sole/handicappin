import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhookEvents, profile } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createServerComponentClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Get user's current plan from database
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    if (userProfile.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const currentPlan = userProfile[0]?.planSelected || 'free';
    const subscriptionStatus = userProfile[0]?.subscriptionStatus;

    // Check recent webhook events (last 5 minutes - typical checkout flow)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = await db
      .select()
      .from(webhookEvents)
      .where(and(
        eq(webhookEvents.userId, userId),
        gte(webhookEvents.processedAt, fiveMinutesAgo)
      ))
      .orderBy(desc(webhookEvents.processedAt));

    // Filter for checkout-related events
    const checkoutEvents = recentEvents.filter(e =>
      e.eventType === 'checkout.session.completed' ||
      e.eventType === 'customer.subscription.created' ||
      e.eventType === 'customer.subscription.updated' ||
      e.eventType === 'payment_intent.succeeded'
    );

    const recentFailures = checkoutEvents.filter(e => e.status === 'failed');
    const lastSuccess = checkoutEvents.find(e => e.status === 'success');

    // Determine status based on database state + webhook events
    let status: 'processing' | 'success' | 'delayed' | 'failed';
    let message: string;
    let action: string | null = null;

    // Success: Plan updated and we have a successful webhook
    if (currentPlan !== 'free' && subscriptionStatus === 'active' && lastSuccess) {
      status = 'success';
      message = 'Your subscription has been activated!';
    }
    // Failed: 3+ webhook failures
    else if (recentFailures.length >= 3) {
      status = 'failed';
      message = 'We encountered an issue activating your subscription.';
      action = 'Our team has been notified and will resolve this within 24 hours. You can also contact support for immediate assistance.';
    }
    // Delayed: Some failures but not exhausted
    else if (recentFailures.length > 0 && recentFailures.length < 3) {
      status = 'delayed';
      message = 'Your payment was successful. Activation is taking longer than usual.';
      action = 'This usually resolves within a few minutes. You can check back or contact support if this persists.';
    }
    // Processing: No plan update yet, no failures
    else {
      status = 'processing';
      message = 'Activating your subscription...';
      action = null;
    }

    return NextResponse.json({
      status,
      message,
      action,
      plan: currentPlan,
      subscriptionStatus,
      failureCount: recentFailures.length,
      hasSuccessfulWebhook: !!lastSuccess,
      // Include debugging info for support
      debug: {
        recentEventCount: checkoutEvents.length,
        lastEventType: checkoutEvents[0]?.eventType,
        lastEventStatus: checkoutEvents[0]?.status,
        lastEventRetryCount: checkoutEvents[0]?.retryCount,
      },
    });
  } catch (error) {
    console.error('Error checking webhook status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
