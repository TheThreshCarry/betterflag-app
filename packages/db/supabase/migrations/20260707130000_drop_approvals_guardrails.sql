-- Remove the approval / guardrail system.
--
-- Betterflag no longer gates agent-initiated mutations behind human approval, a
-- valid agent/admin key executes directly. This drops the guardrail rules and
-- the staged-approval store, along with their indexes and RLS policies
-- (removed automatically with the tables), and the approval_status enum.
--
-- Safe to run whether or not the tables still hold rows; nothing else in the
-- schema references them.

drop table if exists public.approvals cascade;
drop table if exists public.guardrails cascade;
drop type if exists public.approval_status;
