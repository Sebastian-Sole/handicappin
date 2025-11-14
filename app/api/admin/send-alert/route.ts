import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple email alert endpoint
 * TODO: Implement with your email provider (Resend, SendGrid, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json();

    // TODO: Replace with your email service
    // Example with Resend:
    // const { data, error } = await resend.emails.send({
    //   from: 'alerts@handicappin.com',
    //   to: to,
    //   subject: subject,
    //   text: body,
    // });

    // For now, just log (you can implement email service later)
    console.log('📧 Email Alert:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', body);

    // Return success (implement actual email sending when ready)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending email alert:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
