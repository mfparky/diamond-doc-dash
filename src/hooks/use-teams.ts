import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Team {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
  email?: string;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'member' | null>(null);
  const { toast } = useToast();

  const fetchTeams = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTeams([]);
        setCurrentTeam(null);
        setIsLoading(false);
        return;
      }

      // Get all teams the user is a member of
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setTeams([]);
        setCurrentTeam(null);
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const teamIds = memberData.map(m => m.team_id);
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      setTeams(teamsData || []);
      
      // Set the first team as current if none selected
      if (teamsData && teamsData.length > 0) {
        const savedTeamId = localStorage.getItem('currentTeamId');
        const savedTeam = teamsData.find(t => t.id === savedTeamId);
        const teamToSet = savedTeam || teamsData[0];
        setCurrentTeam(teamToSet);
        
        // Get user's role for this team
        const memberRole = memberData.find(m => m.team_id === teamToSet.id);
        setUserRole(memberRole?.role as 'owner' | 'member' || null);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTeamMembers = useCallback(async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;
      // Cast the role to the correct type
      const members: TeamMember[] = (data || []).map(m => ({
        ...m,
        role: m.role as 'owner' | 'member'
      }));
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (currentTeam) {
      fetchTeamMembers(currentTeam.id);
      localStorage.setItem('currentTeamId', currentTeam.id);
    }
  }, [currentTeam, fetchTeamMembers]);

  const createTeam = async (name: string): Promise<Team | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name, owner_id: user.id })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add the creator as an owner member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'owner' });

      if (memberError) throw memberError;

      toast({ title: 'Team created', description: `${name} has been created successfully.` });
      await fetchTeams();
      setCurrentTeam(team);
      setUserRole('owner');
      return team;
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const joinTeam = async (joinCode: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find team by join code
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('join_code', joinCode.toLowerCase().trim())
        .maybeSingle();

      if (teamError) throw teamError;
      if (!team) {
        toast({ title: 'Invalid code', description: 'No team found with that join code.', variant: 'destructive' });
        return false;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Already a member', description: 'You are already a member of this team.' });
        setCurrentTeam(team);
        return true;
      }

      // Join as member
      const { error: joinError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'member' });

      if (joinError) throw joinError;

      toast({ title: 'Joined team', description: `You have joined ${team.name}.` });
      await fetchTeams();
      setCurrentTeam(team);
      setUserRole('member');
      return true;
    } catch (error: any) {
      console.error('Error joining team:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const updateTeam = async (teamId: string, updates: Partial<Team>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);

      if (error) throw error;

      toast({ title: 'Team updated' });
      await fetchTeams();
      return true;
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const removeMember = async (memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Member removed' });
      if (currentTeam) {
        await fetchTeamMembers(currentTeam.id);
      }
      return true;
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const leaveTeam = async (teamId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Left team' });
      localStorage.removeItem('currentTeamId');
      await fetchTeams();
      return true;
    } catch (error: any) {
      console.error('Error leaving team:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const switchTeam = (team: Team) => {
    setCurrentTeam(team);
    // Update role for new team
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', team.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setUserRole(data?.role as 'owner' | 'member' || null);
      }
    };
    fetchRole();
  };

  return {
    teams,
    currentTeam,
    teamMembers,
    userRole,
    isLoading,
    createTeam,
    joinTeam,
    updateTeam,
    removeMember,
    leaveTeam,
    switchTeam,
    refetchTeams: fetchTeams,
  };
}
