'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  Avatar,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';
import {
  Person as PersonIcon,
  People as PeopleIcon,
  Group as GroupIcon
} from '@mui/icons-material';

export default function UserTeamSelector({
  organizationId,
  value = [],
  onChange,
  label = 'Select Users or Teams',
  multiple = true,
  showTeams = true,
  showUsers = true,
  placeholder = 'Search for users or teams...'
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'users', 'teams'

  useEffect(() => {
    if (organizationId) {
      fetchOptions();
    }
  }, [organizationId, filterType]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const promises = [];
      
      if ((filterType === 'all' || filterType === 'users') && showUsers) {
        promises.push(
          fetch(`/api/organizations/${organizationId}/members`)
            .then(res => res.json())
            .then(members => 
              members.map(member => ({
                id: member.users.id,
                type: 'user',
                label: member.users.name,
                email: member.users.email,
                avatar: member.users.avatar_url,
                role: member.users.incident_role,
                isOnCall: member.users.is_on_call,
                data: member
              }))
            )
        );
      }

      if ((filterType === 'all' || filterType === 'teams') && showTeams) {
        promises.push(
          fetch(`/api/teams?organizationId=${organizationId}`)
            .then(res => res.json())
            .then(teams => 
              teams.map(team => ({
                id: team.id,
                type: 'team',
                label: team.name,
                description: team.description,
                color: team.color,
                memberCount: team.members?.length || 0,
                data: team
              }))
            )
        );
      }

      const results = await Promise.all(promises);
      const allOptions = results.flat();
      
      setOptions(allOptions);
    } catch (error) {
      console.error('Error fetching options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true;
    return (
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (option.email && option.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleChange = (event, newValue) => {
    onChange(newValue);
  };

  const getOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option.label || '';
  };

  const renderOption = (props, option) => (
    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
      {option.type === 'user' ? (
        <Avatar 
          src={option.avatar} 
          sx={{ width: 32, height: 32 }}
        >
          {option.label.charAt(0)}
        </Avatar>
      ) : (
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: option.color || '#0066CC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <GroupIcon sx={{ color: 'white', fontSize: 16 }} />
        </Box>
      )}
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {option.label}
          </Typography>
          
          {option.type === 'user' && (
            <>
              <Chip
                icon={<PersonIcon />}
                label={option.role || 'viewer'}
                size="small"
                variant="outlined"
              />
              {option.isOnCall && (
                <Chip
                  label="On Call"
                  size="small"
                  color="success"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </>
          )}
          
          {option.type === 'team' && (
            <Chip
              icon={<PeopleIcon />}
              label={`${option.memberCount} members`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        
        {option.type === 'user' && option.email && (
          <Typography variant="caption" color="text.secondary">
            {option.email}
          </Typography>
        )}
        
        {option.type === 'team' && option.description && (
          <Typography variant="caption" color="text.secondary">
            {option.description}
          </Typography>
        )}
      </Box>
    </Box>
  );

  const renderTags = (tagValue, getTagProps) =>
    tagValue.map((option, index) => (
      <Chip
        {...getTagProps({ index })}
        key={option.id}
        avatar={
          option.type === 'user' ? (
            <Avatar src={option.avatar} sx={{ width: 24, height: 24 }}>
              {option.label.charAt(0)}
            </Avatar>
          ) : (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: option.color || '#0066CC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GroupIcon sx={{ color: 'white', fontSize: 12 }} />
            </Box>
          )
        }
        label={option.label}
        size="small"
      />
    ));

  return (
    <Box>
      {(showUsers && showTeams) && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Filter"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="users">Users Only</MenuItem>
              <MenuItem value="teams">Teams Only</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      <Autocomplete
        multiple={multiple}
        options={filteredOptions}
        value={value}
        onChange={handleChange}
        getOptionLabel={getOptionLabel}
        renderOption={renderOption}
        renderTags={multiple ? renderTags : undefined}
        loading={loading}
        filterOptions={(x) => x} // We handle filtering manually
        onInputChange={(event, newInputValue) => {
          setSearchTerm(newInputValue);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            helperText={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <PersonIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption">
                  Select individual users or entire teams for notifications
                </Typography>
              </Box>
            }
          />
        )}
        groupBy={(option) => option.type === 'user' ? 'Users' : 'Teams'}
        isOptionEqualToValue={(option, value) => option.id === value.id && option.type === value.type}
        sx={{ width: '100%' }}
      />

      {value && value.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Selected ({value.length}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {value.map((item) => (
              <Chip
                key={`${item.type}-${item.id}`}
                avatar={
                  item.type === 'user' ? (
                    <Avatar src={item.avatar} sx={{ width: 24, height: 24 }}>
                      {item.label.charAt(0)}
                    </Avatar>
                  ) : (
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: item.color || '#0066CC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <GroupIcon sx={{ color: 'white', fontSize: 12 }} />
                    </Box>
                  )
                }
                label={`${item.label} (${item.type})`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}