// Playing positions per sport, offered as a dropdown in Edit CV. Sports not listed use a free-text field.
export const POSITIONS_BY_SPORT: Record<string, string[]> = {
  Cricket: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Captain'],
  Football: ['Goalkeeper', 'Defender', 'Right Back', 'Left Back', 'Centre Back', 'Midfielder', 'Winger', 'Striker', 'Forward'],
  Basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Centre'],
  Hockey: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
  Volleyball: ['Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero'],
  Kabaddi: ['Raider', 'Defender', 'All-Rounder', 'Corner', 'Cover'],
  Handball: ['Goalkeeper', 'Wing', 'Back', 'Pivot', 'Centre'],
  Rugby: ['Prop', 'Hooker', 'Lock', 'Flanker', 'Scrum-Half', 'Fly-Half', 'Centre', 'Wing', 'Full-Back'],
  Baseball: ['Pitcher', 'Catcher', 'Infielder', 'Outfielder'],
  'Water Polo': ['Goalkeeper', 'Driver', 'Centre Forward', 'Centre Back', 'Wing'],
};
