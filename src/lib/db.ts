import { supabase } from "./supabaseClient";

/**
 * COURSES
 */

// List courses owned by the currently logged-in educator
export async function listMyCourses() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("educator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Create a course (owned by logged-in educator)
export async function createCourse(payload: { name: string; code: string; term: string }) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("courses")
    .insert({
      educator_id: user.id,
      name: payload.name,
      code: payload.code,
      term: payload.term,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * TEAMS
 */

// List teams for a course
export async function listTeams(courseId: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Create a team within a course
export async function createTeam(courseId: string, name: string) {
  const { data, error } = await supabase
    .from("teams")
    .insert({ course_id: courseId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * STUDENTS / MEMBERSHIP
 */

// Search student profiles by email (educator uses this)
export async function searchStudentsByEmail(query: string) {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("role", "student")
    .ilike("email", `%${q}%`)
    .limit(10);

  if (error) throw error;
  return data ?? [];
}

// Add student to a team
export async function addStudentToTeam(teamId: string, studentId: string) {
  // Get target team so we know which course it belongs to
  const { data: targetTeam, error: targetTeamErr } = await supabase
    .from("teams")
    .select("id, course_id, name")
    .eq("id", teamId)
    .single();

  if (targetTeamErr) throw targetTeamErr;

  // Get all teams in the same course
  const { data: teamsInCourse, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name")
    .eq("course_id", targetTeam.course_id);

  if (teamsErr) throw teamsErr;

  const teamIdsInCourse = (teamsInCourse ?? []).map((t: any) => t.id);

  // Check whether the student is already in a different team in this same course
  if (teamIdsInCourse.length > 0) {
    const { data: existingMemberships, error: existingErr } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("student_id", studentId)
      .in("team_id", teamIdsInCourse);

    if (existingErr) throw existingErr;

    const existing = existingMemberships?.[0];

    if (existing?.team_id) {
      const existingTeam = (teamsInCourse ?? []).find((t: any) => t.id === existing.team_id);

      if (existing.team_id === teamId) {
        throw new Error("This student is already in this team.");
      }

      throw new Error(
        `This student is already assigned to another team in this course${
          existingTeam?.name ? ` (${existingTeam.name})` : ""
        }. Remove them from that team first before adding them here.`
      );
    }
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, student_id: studentId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeStudentFromTeam(teamId: string, studentId: string) {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("student_id", studentId);

  if (error) throw error;
  return true;
}

// List members of a team (for educator view) - normalized result
export async function listTeamMembers(teamId: string) {
  const { data, error } = await supabase
    .from("team_members")
    .select("student_id, profiles:student_id (id, email, display_name)")
    .eq("team_id", teamId);

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as { id: string; email: string | null; display_name: string | null }[];
}

// Student: get current user's membership (null = awaiting assignment)
export async function getMyTeamMembership() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  // 1) membership row
  const { data: memberships, error: memErr } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("student_id", user.id)
    .limit(1);

  if (memErr) throw memErr;

  const membership = memberships?.[0];
  if (!membership?.team_id) return null;

  // 2) team row (use maybeSingle to avoid "coerce" errors)
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, course_id")
    .eq("id", membership.team_id)
    .maybeSingle();

  if (teamErr) throw teamErr;
  if (!team) return null;

  // 3) course row (use maybeSingle as well)
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, name, code, term")
    .eq("id", team.course_id)
    .maybeSingle();

  if (courseErr) throw courseErr;
  if (!course) return null;

  return {
    team_id: membership.team_id,
    teams: {
      id: team.id,
      name: team.name,
      course_id: team.course_id,
      courses: course,
    },
  };
}

/**
 * PEER FEEDBACK (anonymous in UI)
 */

// For a student: list their teammates (profiles) excluding themselves
export async function listMyTeammates() {
  const membership = await getMyTeamMembership();
  if (!membership?.teams?.id) return [];

  const teamId = membership.teams.id;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  // Get all members of this team (profiles) then filter out current user
  const members = await listTeamMembers(teamId);
  return members.filter((m) => m.id !== user.id);
}

export async function submitPeerFeedback(payload: {
  toStudentId: string;
  reliability: number;
  communication: number;
  workQuality: number;
  comment?: string;
  concernTags?: string[];
  privateNote?: string;
}) {
  const membership = await getMyTeamMembership();
  if (!membership?.teams?.id) throw new Error("You are not assigned to a team.");

  const teamId = membership.teams.id;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { error } = await supabase.from("peer_feedback").upsert(
    {
      team_id: teamId,
      from_student_id: user.id,
      to_student_id: payload.toStudentId,
      reliability: payload.reliability,
      communication: payload.communication,
      work_quality: payload.workQuality,
      comment: payload.comment?.trim() ? payload.comment.trim() : null,
      concern_tags: payload.concernTags ?? [],
      private_note: payload.privateNote?.trim() ? payload.privateNote.trim() : null,
    },
    { onConflict: "team_id,from_student_id,to_student_id" }
  );

  if (error) throw error;
}

/**
 * TEAM HEALTH (Educator)
 * Aggregates peer feedback by team for a given course.
 */
export async function getCourseTeamHealth(courseId: string) {
  // 1) Get all teams for this course
  const teams = await listTeams(courseId);

  if (!teams.length) return [];

  // 2) Fetch all feedback rows for teams in this course
  const teamIds = teams.map((t: any) => t.id);

  const { data: feedback, error } = await supabase
    .from("peer_feedback")
    .select("team_id,reliability,communication,work_quality,concern_tags,created_at")
    .in("team_id", teamIds);

  if (error) throw error;

  const rows = feedback ?? [];

  // 3) Aggregate per team
  const byTeam: Record<
    string,
    {
      count: number;
      sumRel: number;
      sumCom: number;
      sumQual: number;
      tagCounts: Record<string, number>;
    }
  > = {};

  for (const r of rows as any[]) {
    const tid = r.team_id as string;
    if (!byTeam[tid]) {
      byTeam[tid] = { count: 0, sumRel: 0, sumCom: 0, sumQual: 0, tagCounts: {} };
    }
    byTeam[tid].count += 1;
    byTeam[tid].sumRel += r.reliability ?? 0;
    byTeam[tid].sumCom += r.communication ?? 0;
    byTeam[tid].sumQual += r.work_quality ?? 0;

    const tags: string[] = r.concern_tags ?? [];
    for (const tag of tags) {
      byTeam[tid].tagCounts[tag] = (byTeam[tid].tagCounts[tag] ?? 0) + 1;
    }
  }

  // 4) Return a clean array for UI
  return teams.map((t: any) => {
    const agg = byTeam[t.id];
    const count = agg?.count ?? 0;

    const avgRel = count ? agg!.sumRel / count : null;
    const avgCom = count ? agg!.sumCom / count : null;
    const avgQual = count ? agg!.sumQual / count : null;

    const topTags = agg
      ? Object.entries(agg.tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag, n]) => ({ tag, n }))
      : [];

    const risk =
      count >= 3 && (avgRel! < 3 || avgCom! < 3 || avgQual! < 3) ? "At risk" : "OK";

    return {
      team_id: t.id,
      team_name: t.name,
      feedback_count: count,
      avg_reliability: avgRel,
      avg_communication: avgCom,
      avg_work_quality: avgQual,
      top_tags: topTags,
      risk,
    };
  });
}

/**
 * WORK LOGS
 * Team workspace: list logs for a team + create a new log.
 */

export type WorkLogRow = {
  id: string;
  team_id: string;
  student_id: string;
  title: string;
  description: string | null;
  minutes: number;
  link: string | null;
  created_at: string;
  profiles: {
    id: string;
    email: string | null;
    display_name: string | null;
  } | null;
};

export async function listTeamWorkLogs(teamId: string): Promise<WorkLogRow[]> {
  const { data, error } = await supabase
    .from("work_logs")
    .select(
      `
      id,
      team_id,
      student_id,
      title,
      description,
      minutes,
      link,
      created_at,
      profiles:student_id (
        id,
        email,
        display_name
      )
    `
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    profiles: row.profiles ?? null,
  })) as WorkLogRow[];
}

export async function createWorkLog(payload: {
  teamId: string;
  title: string;
  description?: string;
  minutes?: number;
  link?: string;
}) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("work_logs")
    .insert({
      team_id: payload.teamId,
      student_id: user.id,
      title: payload.title,
      description: payload.description ?? null,
      minutes: payload.minutes ?? 0,
      link: payload.link ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * TASKS (MVP)
 * todo / doing / done, optional assignment
 */

export type TaskStatus = "todo" | "doing" | "done";

export type TaskRow = {
  id: string;
  team_id: string;
  title: string;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  assigned_profile?: { id: string; email: string | null; display_name: string | null } | null;
};

// List tasks for a team
export async function listTeamTasks(teamId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id, team_id, created_by, assigned_to, title, status, created_at, updated_at,
      assigned_profile:assigned_to ( id, email, display_name )
    `
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    ...r,
    assigned_profile: r.assigned_profile ?? null,
  })) as TaskRow[];
}

export async function createTask(payload: {
  teamId: string;
  title: string;
  assignedTo?: string | null;
}) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      team_id: payload.teamId,
      created_by: user.id,
      title: payload.title,
      status: "todo",
      assigned_to: payload.assignedTo ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) throw error;
  return true;
}

export async function assignTask(taskId: string, assignedTo: string | null) {
  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: assignedTo })
    .eq("id", taskId);

  if (error) throw error;
  return true;
}

// For Workspace assignment dropdown: list ALL members of my team (including me)
export async function listMyTeamMembers() {
  const membership = await getMyTeamMembership();
  if (!membership?.teams?.id) return [];

  const teamId = membership.teams.id;
  const members = await listTeamMembers(teamId);
  return members;
}

// ============================
// EDUCATOR TEAM VIEW (MVP)
// ============================

export type TeamHeader = {
  team_id: string;
  team_name: string;
  course_id: string;
  course: { id: string; name: string; code: string; term: string; educator_id?: string };
};

export async function getTeamHeader(teamId: string): Promise<TeamHeader> {
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id,name,course_id")
    .eq("id", teamId)
    .single();

  if (teamErr) throw teamErr;

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id,name,code,term,educator_id")
    .eq("id", team.course_id)
    .single();

  if (courseErr) throw courseErr;

  return {
    team_id: team.id,
    team_name: team.name,
    course_id: team.course_id,
    course,
  };
}

export async function getTeamWorkLogSummary(teamId: string) {
  const logs = await listTeamWorkLogs(teamId);

  const totalMinutes = logs.reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  const recent = logs.slice(0, 8);

  return { totalMinutes, recent, count: logs.length };
}

export async function getTeamTaskSummary(teamId: string) {
  const tasks = await listTeamTasks(teamId);

  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  const recent = tasks.slice(0, 12);
  return { counts, recent, count: tasks.length };
}

export async function getTeamFeedbackSummary(teamId: string) {
  const { data, error } = await supabase
    .from("peer_feedback")
    .select("reliability,communication,work_quality,concern_tags,created_at")
    .eq("team_id", teamId);

  if (error) throw error;

  const rows = data ?? [];
  const n = rows.length;

  if (!n) {
    return {
      count: 0,
      avg_reliability: null,
      avg_communication: null,
      avg_work_quality: null,
      top_tags: [] as { tag: string; n: number }[],
      risk: "OK" as "OK" | "At risk",
    };
  }

  let sumRel = 0;
  let sumCom = 0;
  let sumQual = 0;
  const tagCounts: Record<string, number> = {};

  for (const r of rows as any[]) {
    sumRel += r.reliability ?? 0;
    sumCom += r.communication ?? 0;
    sumQual += r.work_quality ?? 0;

    const tags: string[] = r.concern_tags ?? [];
    for (const tag of tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }

  const avgRel = sumRel / n;
  const avgCom = sumCom / n;
  const avgQual = sumQual / n;

  const top_tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, n]) => ({ tag, n }));

  const risk = n >= 3 && (avgRel < 3 || avgCom < 3 || avgQual < 3) ? "At risk" : "OK";

  return {
    count: n,
    avg_reliability: avgRel,
    avg_communication: avgCom,
    avg_work_quality: avgQual,
    top_tags,
    risk,
  };
}

export async function getTeamMetaForCourse(courseId: string) {
  const teams = await listTeams(courseId);
  if (!teams.length) return [];

  const teamIds = teams.map((t: any) => t.id);

  const { data: members, error: memErr } = await supabase
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);

  if (memErr) throw memErr;

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("team_id,status")
    .in("team_id", teamIds);

  if (taskErr) throw taskErr;

  const memberCountByTeam: Record<string, number> = {};
  for (const r of members ?? []) {
    const tid = (r as any).team_id as string;
    memberCountByTeam[tid] = (memberCountByTeam[tid] ?? 0) + 1;
  }

  const openByTeam: Record<string, number> = {};
  const doneByTeam: Record<string, number> = {};

  for (const r of tasks ?? []) {
    const tid = (r as any).team_id as string;
    const st = (r as any).status as TaskStatus;

    if (st === "done") doneByTeam[tid] = (doneByTeam[tid] ?? 0) + 1;
    else openByTeam[tid] = (openByTeam[tid] ?? 0) + 1;
  }

  return teams.map((t: any) => ({
    team_id: t.id,
    team_name: t.name,
    member_count: memberCountByTeam[t.id] ?? 0,
    open_tasks: openByTeam[t.id] ?? 0,
    done_tasks: doneByTeam[t.id] ?? 0,
  }));
}

// Educator team detail: team + course + roster
export async function getTeamDetailsForEducator(teamId: string) {
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id,name,course_id")
    .eq("id", teamId)
    .single();

  if (teamErr) throw teamErr;

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id,name,code,term")
    .eq("id", team.course_id)
    .single();

  if (courseErr) throw courseErr;

  const members = await listTeamMembers(teamId);

  return {
    team_id: team.id,
    team_name: team.name,
    course,
    members,
  };
}

export type FeedbackTagCount = { tag: string; n: number };

export type FeedbackSummary = {
  count: number;
  avg_reliability: number | null;
  avg_communication: number | null;
  avg_work_quality: number | null;
  avg_overall: number | null;
  top_tags: FeedbackTagCount[];
};

export type ReceivedFeedbackEntry = {
  created_at: string;
  reliability: number;
  communication: number;
  work_quality: number;
  comment: string | null;
  concern_tags: string[];
  average_score: number;
};

export type ReceivedFeedbackResult = {
  summary: FeedbackSummary;
  entries: ReceivedFeedbackEntry[];
};

export type EducatorFeedbackStudentView = {
  student: {
    id: string;
    email: string | null;
    display_name: string | null;
  };
  summary: FeedbackSummary;
  comments: { text: string; created_at: string }[];
  private_notes: { text: string; created_at: string }[];
};

function buildFeedbackSummary(
  rows: Array<{
    reliability?: number | null;
    communication?: number | null;
    work_quality?: number | null;
    concern_tags?: string[] | null;
  }>
): FeedbackSummary {
  const count = rows.length;

  if (!count) {
    return {
      count: 0,
      avg_reliability: null,
      avg_communication: null,
      avg_work_quality: null,
      avg_overall: null,
      top_tags: [],
    };
  }

  let sumRel = 0;
  let sumCom = 0;
  let sumQual = 0;
  const tagCounts: Record<string, number> = {};

  for (const row of rows) {
    sumRel += row.reliability ?? 0;
    sumCom += row.communication ?? 0;
    sumQual += row.work_quality ?? 0;

    for (const tag of row.concern_tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const avgRel = sumRel / count;
  const avgCom = sumCom / count;
  const avgQual = sumQual / count;
  const avgOverall = (avgRel + avgCom + avgQual) / 3;

  const top_tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, n]) => ({ tag, n }));

  return {
    count,
    avg_reliability: avgRel,
    avg_communication: avgCom,
    avg_work_quality: avgQual,
    avg_overall: avgOverall,
    top_tags,
  };
}

export async function getMyReceivedFeedback(): Promise<ReceivedFeedbackResult> {
  const membership = await getMyTeamMembership();
  if (!membership?.teams?.id) {
    return {
      summary: {
        count: 0,
        avg_reliability: null,
        avg_communication: null,
        avg_work_quality: null,
        avg_overall: null,
        top_tags: [],
      },
      entries: [],
    };
  }

  const teamId = membership.teams.id;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("peer_feedback")
    .select("created_at,reliability,communication,work_quality,comment,concern_tags")
    .eq("team_id", teamId)
    .eq("to_student_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];

  const entries: ReceivedFeedbackEntry[] = rows.map((row) => {
    const reliability = row.reliability ?? 0;
    const communication = row.communication ?? 0;
    const workQuality = row.work_quality ?? 0;

    return {
      created_at: row.created_at,
      reliability,
      communication,
      work_quality: workQuality,
      comment: row.comment ?? null,
      concern_tags: row.concern_tags ?? [],
      average_score: (reliability + communication + workQuality) / 3,
    };
  });

  return {
    summary: buildFeedbackSummary(rows),
    entries,
  };
}

export async function getTeamFeedbackForEducator(
  teamId: string
): Promise<EducatorFeedbackStudentView[]> {
  const members = await listTeamMembers(teamId);

  const { data, error } = await supabase
    .from("peer_feedback")
    .select(
      "to_student_id,reliability,communication,work_quality,comment,private_note,concern_tags,created_at"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];

  return members.map((member) => {
    const studentRows = rows.filter((row) => row.to_student_id === member.id);

    const comments = studentRows
      .filter((row) => typeof row.comment === "string" && row.comment.trim())
      .map((row) => ({
        text: row.comment.trim(),
        created_at: row.created_at,
      }));

    const private_notes = studentRows
      .filter((row) => typeof row.private_note === "string" && row.private_note.trim())
      .map((row) => ({
        text: row.private_note.trim(),
        created_at: row.created_at,
      }));

    return {
      student: member,
      summary: buildFeedbackSummary(studentRows),
      comments,
      private_notes,
    };
  });
}

export type StudentContributionSummary = {
  team: {
    id: string;
    name: string;
    course_name: string;
    course_code: string;
    term: string;
  } | null;
  task_counts: {
    total: number;
    todo: number;
    doing: number;
    done: number;
  };
  recent_assigned_tasks: TaskRow[];
  worklog_summary: {
    count: number;
    total_minutes: number;
    recent: WorkLogRow[];
  };
  feedback_summary: {
    count: number;
    avg_reliability: number | null;
    avg_communication: number | null;
    avg_work_quality: number | null;
    avg_overall: number | null;
    top_tags: { tag: string; n: number }[];
  };
  strengths: string[];
  attention_areas: string[];
};

function emptyContributionSummary(): StudentContributionSummary {
  return {
    team: null,
    task_counts: {
      total: 0,
      todo: 0,
      doing: 0,
      done: 0,
    },
    recent_assigned_tasks: [],
    worklog_summary: {
      count: 0,
      total_minutes: 0,
      recent: [],
    },
    feedback_summary: {
      count: 0,
      avg_reliability: null,
      avg_communication: null,
      avg_work_quality: null,
      avg_overall: null,
      top_tags: [],
    },
    strengths: [],
    attention_areas: [],
  };
}

export async function getMyContributionSummary(): Promise<StudentContributionSummary> {
  const membership = await getMyTeamMembership();
  if (!membership?.teams?.id || !membership?.teams?.courses) {
    return emptyContributionSummary();
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const teamId = membership.teams.id;

  const [tasks, logs, feedbackRes] = await Promise.all([
    listTeamTasks(teamId),
    listTeamWorkLogs(teamId),
    supabase
      .from("peer_feedback")
      .select("reliability,communication,work_quality,concern_tags,created_at")
      .eq("team_id", teamId)
      .eq("to_student_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (feedbackRes.error) throw feedbackRes.error;

  const assignedTasks = tasks.filter((t) => t.assigned_to === user.id);
  const myLogs = logs.filter((l) => l.student_id === user.id);

  const task_counts = {
    total: assignedTasks.length,
    todo: assignedTasks.filter((t) => t.status === "todo").length,
    doing: assignedTasks.filter((t) => t.status === "doing").length,
    done: assignedTasks.filter((t) => t.status === "done").length,
  };

  const worklog_summary = {
    count: myLogs.length,
    total_minutes: myLogs.reduce((sum, l) => sum + (l.minutes ?? 0), 0),
    recent: myLogs.slice(0, 5),
  };

  const feedbackRows = (feedbackRes.data ?? []) as Array<{
    reliability: number | null;
    communication: number | null;
    work_quality: number | null;
    concern_tags: string[] | null;
    created_at: string;
  }>;

  const feedbackCount = feedbackRows.length;

  const sumRel = feedbackRows.reduce((sum, r) => sum + (r.reliability ?? 0), 0);
  const sumCom = feedbackRows.reduce((sum, r) => sum + (r.communication ?? 0), 0);
  const sumQual = feedbackRows.reduce((sum, r) => sum + (r.work_quality ?? 0), 0);

  const avgRel = feedbackCount ? sumRel / feedbackCount : null;
  const avgCom = feedbackCount ? sumCom / feedbackCount : null;
  const avgQual = feedbackCount ? sumQual / feedbackCount : null;
  const avgOverall =
    avgRel != null && avgCom != null && avgQual != null
      ? (avgRel + avgCom + avgQual) / 3
      : null;

  const tagCounts: Record<string, number> = {};
  for (const row of feedbackRows) {
    for (const tag of row.concern_tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const top_tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, n]) => ({ tag, n }));

  const strengths: string[] = [];
  const attention_areas: string[] = [];

  if (task_counts.done >= 2) {
    strengths.push("You have completed multiple assigned tasks.");
  }
  if (worklog_summary.total_minutes >= 60) {
    strengths.push("You have consistently logged work for the team.");
  }
  if (avgOverall != null && avgOverall >= 4) {
    strengths.push("Peer feedback suggests a strong overall contribution.");
  }
  if (avgCom != null && avgCom >= 4) {
    strengths.push("Communication is being rated positively by teammates.");
  }
  if (avgRel != null && avgRel >= 4) {
    strengths.push("Reliability is being rated positively by teammates.");
  }
  if (avgQual != null && avgQual >= 4) {
    strengths.push("Work quality is being rated positively by teammates.");
  }

  if (task_counts.todo > 0) {
    attention_areas.push("You still have assigned tasks marked as To do.");
  }
  if (task_counts.doing > 0) {
    attention_areas.push("You have active work in progress that still needs completing.");
  }
  if (worklog_summary.count === 0) {
    attention_areas.push("You have not logged any work yet.");
  }
  if (avgOverall != null && avgOverall < 3) {
    attention_areas.push("Recent peer feedback suggests your contribution may need attention.");
  }
  if (top_tags.some((t) => t.tag === "Missed deadlines")) {
    attention_areas.push("Missed deadlines appears as a repeated concern tag.");
  }
  if (top_tags.some((t) => t.tag === "Poor communication")) {
    attention_areas.push("Communication appears as a repeated concern tag.");
  }
  if (top_tags.some((t) => t.tag === "Quality issues")) {
    attention_areas.push("Quality issues appear as a repeated concern tag.");
  }
  if (top_tags.some((t) => t.tag === "Unequal workload")) {
    attention_areas.push("Unequal workload appears as a repeated concern tag.");
  }

  return {
    team: {
      id: membership.teams.id,
      name: membership.teams.name,
      course_name: membership.teams.courses.name,
      course_code: membership.teams.courses.code,
      term: membership.teams.courses.term,
    },
    task_counts,
    recent_assigned_tasks: assignedTasks.slice(0, 5),
    worklog_summary,
    feedback_summary: {
      count: feedbackCount,
      avg_reliability: avgRel,
      avg_communication: avgCom,
      avg_work_quality: avgQual,
      avg_overall: avgOverall,
      top_tags,
    },
    strengths,
    attention_areas,
  };
}

export type TeamNoteRow = {
  id: string;
  team_id: string;
  content: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamResourceKind = "link" | "file" | "resource";

export type TeamResourceRow = {
  id: string;
  team_id: string;
  title: string;
  url: string;
  kind: TeamResourceKind;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getTeamNote(teamId: string): Promise<TeamNoteRow | null> {
  const { data, error } = await supabase
    .from("team_notes")
    .select("id, team_id, content, updated_by, created_at, updated_at")
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertTeamNote(teamId: string, content: string) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("team_notes")
    .upsert(
      {
        team_id: teamId,
        content,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    )
    .select("id, team_id, content, updated_by, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as TeamNoteRow;
}

export async function listTeamResources(teamId: string): Promise<TeamResourceRow[]> {
  const { data, error } = await supabase
    .from("team_resources")
    .select("id, team_id, title, url, kind, description, created_by, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TeamResourceRow[];
}

export async function createTeamResource(payload: {
  teamId: string;
  title: string;
  url: string;
  kind: TeamResourceKind;
  description?: string;
}) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not logged in.");

  const { data, error } = await supabase
    .from("team_resources")
    .insert({
      team_id: payload.teamId,
      title: payload.title,
      url: payload.url,
      kind: payload.kind,
      description: payload.description?.trim() ? payload.description.trim() : null,
      created_by: user.id,
    })
    .select("id, team_id, title, url, kind, description, created_by, created_at")
    .single();

  if (error) throw error;
  return data as TeamResourceRow;
}

export async function deleteTeamResource(resourceId: string) {
  const { error } = await supabase
    .from("team_resources")
    .delete()
    .eq("id", resourceId);

  if (error) throw error;
  return true;
}

export type EducatorStudentContributionSummary = {
  student: {
    id: string;
    email: string | null;
    display_name: string | null;
  };
  task_counts: {
    total: number;
    todo: number;
    doing: number;
    done: number;
  };
  worklog_summary: {
    count: number;
    total_minutes: number;
  };
  feedback_summary: {
    count: number;
    avg_reliability: number | null;
    avg_communication: number | null;
    avg_work_quality: number | null;
    avg_overall: number | null;
    top_tags: { tag: string; n: number }[];
  };
  recent_tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    created_at: string;
  }[];
  recent_logs: {
    id: string;
    title: string;
    minutes: number;
    created_at: string;
  }[];
  flags: string[];
};

export async function getEducatorStudentContributionSummary(
  teamId: string
): Promise<EducatorStudentContributionSummary[]> {
  const [members, tasks, logs, feedbackRes] = await Promise.all([
    listTeamMembers(teamId),
    listTeamTasks(teamId),
    listTeamWorkLogs(teamId),
    supabase
      .from("peer_feedback")
      .select("to_student_id,reliability,communication,work_quality,concern_tags,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
  ]);

  if (feedbackRes.error) throw feedbackRes.error;

  const feedbackRows = (feedbackRes.data ?? []) as Array<{
    to_student_id: string;
    reliability: number | null;
    communication: number | null;
    work_quality: number | null;
    concern_tags: string[] | null;
    created_at: string;
  }>;

  return members.map((member) => {
    const studentTasks = tasks.filter((t) => t.assigned_to === member.id);
    const studentLogs = logs.filter((l) => l.student_id === member.id);
    const studentFeedback = feedbackRows.filter((r) => r.to_student_id === member.id);

    const task_counts = {
      total: studentTasks.length,
      todo: studentTasks.filter((t) => t.status === "todo").length,
      doing: studentTasks.filter((t) => t.status === "doing").length,
      done: studentTasks.filter((t) => t.status === "done").length,
    };

    const worklog_summary = {
      count: studentLogs.length,
      total_minutes: studentLogs.reduce((sum, l) => sum + (l.minutes ?? 0), 0),
    };

    const feedbackCount = studentFeedback.length;
    const sumRel = studentFeedback.reduce((sum, r) => sum + (r.reliability ?? 0), 0);
    const sumCom = studentFeedback.reduce((sum, r) => sum + (r.communication ?? 0), 0);
    const sumQual = studentFeedback.reduce((sum, r) => sum + (r.work_quality ?? 0), 0);

    const avgRel = feedbackCount ? sumRel / feedbackCount : null;
    const avgCom = feedbackCount ? sumCom / feedbackCount : null;
    const avgQual = feedbackCount ? sumQual / feedbackCount : null;
    const avgOverall =
      avgRel != null && avgCom != null && avgQual != null
        ? (avgRel + avgCom + avgQual) / 3
        : null;

    const tagCounts: Record<string, number> = {};
    for (const row of studentFeedback) {
      for (const tag of row.concern_tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }

    const top_tags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, n]) => ({ tag, n }));

    const flags: string[] = [];

    if (task_counts.todo > 0) {
      flags.push("Has tasks still marked To do.");
    }
    if (task_counts.doing > 0) {
      flags.push("Has active work still in progress.");
    }
    if (worklog_summary.count === 0) {
      flags.push("No work logged yet.");
    }
    if (avgOverall != null && avgOverall < 3) {
      flags.push("Peer feedback average is below 3.");
    }
    if (top_tags.some((t) => t.tag === "Missed deadlines")) {
      flags.push("Repeated missed deadlines concern.");
    }
    if (top_tags.some((t) => t.tag === "Poor communication")) {
      flags.push("Repeated communication concern.");
    }
    if (top_tags.some((t) => t.tag === "Quality issues")) {
      flags.push("Repeated quality concern.");
    }
    if (top_tags.some((t) => t.tag === "Unequal workload")) {
      flags.push("Repeated unequal workload concern.");
    }

    return {
      student: member,
      task_counts,
      worklog_summary,
      feedback_summary: {
        count: feedbackCount,
        avg_reliability: avgRel,
        avg_communication: avgCom,
        avg_work_quality: avgQual,
        avg_overall: avgOverall,
        top_tags,
      },
      recent_tasks: studentTasks.slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        created_at: t.created_at,
      })),
      recent_logs: studentLogs.slice(0, 3).map((l) => ({
        id: l.id,
        title: l.title,
        minutes: l.minutes ?? 0,
        created_at: l.created_at,
      })),
      flags,
    };
  });
}

export type EducatorDashboardTeamSummary = {
  team_id: string;
  team_name: string;
  member_count: number;
  task_counts: {
    total: number;
    todo: number;
    doing: number;
    done: number;
  };
  worklog_summary: {
    count: number;
    total_minutes: number;
  };
  feedback_summary: {
    count: number;
    avg_reliability: number | null;
    avg_communication: number | null;
    avg_work_quality: number | null;
    avg_overall: number | null;
    top_tags: { tag: string; n: number }[];
  };
  risk: "OK" | "At risk";
  risk_reasons: string[];
};

export type EducatorDashboardCourseSummary = {
  course: {
    id: string;
    name: string;
    code: string;
    term: string;
  };
  totals: {
    teams: number;
    students: number;
    tasks: number;
    done_tasks: number;
    worklog_entries: number;
    worklog_minutes: number;
    feedback_entries: number;
    at_risk_teams: number;
  };
  teams: EducatorDashboardTeamSummary[];
};

export async function getEducatorDashboardSummary(): Promise<EducatorDashboardCourseSummary[]> {
  const courses = await listMyCourses();
  if (!courses.length) return [];

  const courseIds = courses.map((c: any) => c.id);

  const { data: teamsData, error: teamsErr } = await supabase
    .from("teams")
    .select("id,name,course_id")
    .in("course_id", courseIds);

  if (teamsErr) throw teamsErr;

  const teams = teamsData ?? [];
  const teamIds = teams.map((t: any) => t.id);

  const [membersRes, tasksRes, logsRes, feedbackRes] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id,student_id").in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from("tasks").select("team_id,status").in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from("work_logs").select("team_id,minutes").in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase
          .from("peer_feedback")
          .select("team_id,reliability,communication,work_quality,concern_tags")
          .in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (logsRes.error) throw logsRes.error;
  if (feedbackRes.error) throw feedbackRes.error;

  const members = membersRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const logs = logsRes.data ?? [];
  const feedback = feedbackRes.data ?? [];

  const membersByTeam: Record<string, number> = {};
  for (const row of members as any[]) {
    membersByTeam[row.team_id] = (membersByTeam[row.team_id] ?? 0) + 1;
  }

  const tasksByTeam: Record<
    string,
    { total: number; todo: number; doing: number; done: number }
  > = {};
  for (const row of tasks as any[]) {
    const tid = row.team_id as string;
    if (!tasksByTeam[tid]) {
      tasksByTeam[tid] = { total: 0, todo: 0, doing: 0, done: 0 };
    }
    tasksByTeam[tid].total += 1;
    if (row.status === "todo") tasksByTeam[tid].todo += 1;
    else if (row.status === "doing") tasksByTeam[tid].doing += 1;
    else if (row.status === "done") tasksByTeam[tid].done += 1;
  }

  const logsByTeam: Record<string, { count: number; total_minutes: number }> = {};
  for (const row of logs as any[]) {
    const tid = row.team_id as string;
    if (!logsByTeam[tid]) {
      logsByTeam[tid] = { count: 0, total_minutes: 0 };
    }
    logsByTeam[tid].count += 1;
    logsByTeam[tid].total_minutes += row.minutes ?? 0;
  }

  const feedbackByTeam: Record<
    string,
    {
      count: number;
      sumRel: number;
      sumCom: number;
      sumQual: number;
      tagCounts: Record<string, number>;
    }
  > = {};

  for (const row of feedback as any[]) {
    const tid = row.team_id as string;
    if (!feedbackByTeam[tid]) {
      feedbackByTeam[tid] = {
        count: 0,
        sumRel: 0,
        sumCom: 0,
        sumQual: 0,
        tagCounts: {},
      };
    }

    feedbackByTeam[tid].count += 1;
    feedbackByTeam[tid].sumRel += row.reliability ?? 0;
    feedbackByTeam[tid].sumCom += row.communication ?? 0;
    feedbackByTeam[tid].sumQual += row.work_quality ?? 0;

    for (const tag of row.concern_tags ?? []) {
      feedbackByTeam[tid].tagCounts[tag] = (feedbackByTeam[tid].tagCounts[tag] ?? 0) + 1;
    }
  }

  const teamSummaries: EducatorDashboardTeamSummary[] = teams.map((team: any) => {
    const task = tasksByTeam[team.id] ?? { total: 0, todo: 0, doing: 0, done: 0 };
    const log = logsByTeam[team.id] ?? { count: 0, total_minutes: 0 };
    const feed = feedbackByTeam[team.id] ?? {
      count: 0,
      sumRel: 0,
      sumCom: 0,
      sumQual: 0,
      tagCounts: {},
    };

    const avgRel = feed.count ? feed.sumRel / feed.count : null;
    const avgCom = feed.count ? feed.sumCom / feed.count : null;
    const avgQual = feed.count ? feed.sumQual / feed.count : null;
    const avgOverall =
      avgRel != null && avgCom != null && avgQual != null
        ? (avgRel + avgCom + avgQual) / 3
        : null;

    const top_tags = Object.entries(feed.tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag, n]) => ({ tag, n }));

    const risk_reasons: string[] = [];

    if (task.todo > 0) risk_reasons.push("Outstanding To do tasks.");
    if (task.doing > 0) risk_reasons.push("Work still in progress.");
    if (log.count === 0) risk_reasons.push("No work logs recorded.");
    if (avgOverall != null && avgOverall < 3) risk_reasons.push("Low feedback average.");
    if (top_tags.some((t) => t.tag === "Missed deadlines")) {
      risk_reasons.push("Missed deadlines flagged.");
    }
    if (top_tags.some((t) => t.tag === "Poor communication")) {
      risk_reasons.push("Communication concerns flagged.");
    }

    return {
      team_id: team.id,
      team_name: team.name,
      member_count: membersByTeam[team.id] ?? 0,
      task_counts: task,
      worklog_summary: log,
      feedback_summary: {
        count: feed.count,
        avg_reliability: avgRel,
        avg_communication: avgCom,
        avg_work_quality: avgQual,
        avg_overall: avgOverall,
        top_tags,
      },
      risk: risk_reasons.length ? "At risk" : "OK",
      risk_reasons,
    };
  });

  return courses.map((course: any) => {
    const courseTeams = teamSummaries.filter(
      (team) => teams.find((t: any) => t.id === team.team_id)?.course_id === course.id
    );

    return {
      course: {
        id: course.id,
        name: course.name,
        code: course.code,
        term: course.term,
      },
      totals: {
        teams: courseTeams.length,
        students: courseTeams.reduce((sum, t) => sum + t.member_count, 0),
        tasks: courseTeams.reduce((sum, t) => sum + t.task_counts.total, 0),
        done_tasks: courseTeams.reduce((sum, t) => sum + t.task_counts.done, 0),
        worklog_entries: courseTeams.reduce((sum, t) => sum + t.worklog_summary.count, 0),
        worklog_minutes: courseTeams.reduce((sum, t) => sum + t.worklog_summary.total_minutes, 0),
        feedback_entries: courseTeams.reduce((sum, t) => sum + t.feedback_summary.count, 0),
        at_risk_teams: courseTeams.filter((t) => t.risk === "At risk").length,
      },
      teams: courseTeams,
    };
  });
}