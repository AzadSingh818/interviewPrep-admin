import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authErrorStatus, requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const requests = await prisma.manualBookingRequest.findMany({
      where: status === 'ALL' ? {} : { status: status as any },
      include: {
        studentProfile: {
          include: {
            user: { select: { email: true, name: true, profilePicture: true } },
          },
        },
        interviewerProfile: {
          include: {
            user: { select: { email: true, name: true, profilePicture: true } },
          },
        },
        session: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const normalized = requests.map((request) => ({
      id: request.id,
      status: request.status,
      sessionType: request.sessionType,
      role: request.role,
      difficulty: request.difficulty,
      interviewType: request.interviewType,
      topic: request.topic,
      paymentStatus: request.paymentStatus,
      createdAt: request.createdAt,
      preferredInterviewerId: request.preferredInterviewerId,
      student: {
        name: request.studentProfile.name,
        user: request.studentProfile.user,
      },
      preferredInterviewer: request.interviewerProfile
        ? {
            name: request.interviewerProfile.name,
            user: request.interviewerProfile.user,
          }
        : null,
      session: request.session ? { id: request.session.id } : null,
    }));

    return NextResponse.json({ requests: normalized });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();
    const requestId = Number(body.requestId);
    const interviewerId = Number(body.interviewerId);
    const scheduledTime = body.scheduledTime;
    const durationMinutes = Number(body.durationMinutes || 60);

    if (!requestId || !interviewerId || !scheduledTime) {
      return NextResponse.json(
        { error: 'requestId, interviewerId and scheduledTime are required.' },
        { status: 400 }
      );
    }

    const manualRequest = await prisma.manualBookingRequest.findUnique({
      where: { id: requestId },
      include: {
        studentProfile: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    if (!manualRequest || manualRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is unavailable.' }, { status: 400 });
    }

    const interviewer = await prisma.interviewerProfile.findUnique({
      where: { id: interviewerId },
    });

    if (!interviewer || interviewer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Interviewer not approved.' }, { status: 400 });
    }

    const session = await prisma.session.create({
      data: {
        studentId: manualRequest.studentId,
        interviewerId,
        sessionType: manualRequest.sessionType,
        status: 'SCHEDULED',
        scheduledTime: new Date(scheduledTime),
        durationMinutes,
        topic: manualRequest.topic || null,
        role: manualRequest.role || null,
        difficulty: manualRequest.difficulty || null,
        interviewType: manualRequest.interviewType || null,
      },
    });

    await prisma.manualBookingRequest.update({
      where: { id: manualRequest.id },
      data: {
        status: 'ASSIGNED',
        preferredInterviewerId: interviewerId,
        sessionId: session.id,
      },
    });

    await prisma.studentProfile.update({
      where: { id: manualRequest.studentId },
      data:
        manualRequest.sessionType === 'INTERVIEW'
          ? { interviewsUsed: { increment: 1 } }
          : { guidanceUsed: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      message: 'Interviewer assigned successfully.',
      sessionId: session.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}
