-- Migration: Add approval status cascade triggers
-- Purpose: Automatically approve rounds when both their associated course and tee are approved
-- Affected tables: course, teeInfo, round
-- Special considerations: Only approves rounds, never changes approval status in reverse direction

-- Function to handle approval status cascading to rounds
-- This function checks if a round's course and tee are both approved, and if so, approves the round
create or replace function public.cascade_approval_to_rounds()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_rounds_count integer;
begin
  -- Only proceed if the approval status was changed to 'approved'
  if new."approvalStatus" = 'approved' and (old."approvalStatus" is null or old."approvalStatus" != 'approved') then
    
    if tg_table_name = 'course' then
      -- Course was approved: update rounds where both course and tee are approved
      update public.round 
      set "approvalStatus" = 'approved'
      where "courseId" = new.id
        and "approvalStatus" != 'approved'
        and "teeId" in (
          select t.id 
          from public."teeInfo" t 
          where t."approvalStatus" = 'approved'
        );
      
      get diagnostics affected_rounds_count = row_count;
      
      -- Log the operation for debugging (optional)
      if affected_rounds_count > 0 then
        raise notice 'Course % approved: automatically approved % rounds', new.name, affected_rounds_count;
      end if;
      
    elsif tg_table_name = 'teeInfo' then
      -- Tee was approved: update rounds where both course and tee are approved
      update public.round 
      set "approvalStatus" = 'approved'
      where "teeId" = new.id
        and "approvalStatus" != 'approved'
        and "courseId" in (
          select c.id 
          from public.course c 
          where c."approvalStatus" = 'approved'
        );
      
      get diagnostics affected_rounds_count = row_count;
      
      -- Log the operation for debugging (optional)
      if affected_rounds_count > 0 then
        raise notice 'Tee % approved: automatically approved % rounds', new.name, affected_rounds_count;
      end if;
      
    end if;
  end if;
  
  return new;
end;
$$;

-- Create trigger on course table
-- Fires after update to check if course approval should cascade to rounds
drop trigger if exists trigger_course_approval_cascade on public.course;
create trigger trigger_course_approval_cascade
  after update on public.course
  for each row
  when (new."approvalStatus" = 'approved' and old."approvalStatus" != 'approved')
  execute function public.cascade_approval_to_rounds();

-- Create trigger on teeInfo table  
-- Fires after update to check if tee approval should cascade to rounds
drop trigger if exists trigger_tee_approval_cascade on public."teeInfo";
create trigger trigger_tee_approval_cascade
  after update on public."teeInfo"
  for each row
  when (new."approvalStatus" = 'approved' and old."approvalStatus" != 'approved')
  execute function public.cascade_approval_to_rounds();
