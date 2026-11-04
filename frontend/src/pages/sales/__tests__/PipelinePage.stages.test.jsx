import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PipelinePage from '../PipelinePage.jsx';
const state = vi.hoisted(() => ({ stages: [], move: vi.fn(), board: vi.fn() }));
vi.mock('../../../api.js', () => ({ api: { leads: { board: state.board, move: state.move } } }));
vi.mock('../../../hooks/useServerEvents.js', () => ({ useServerEvents: () => {} }));
vi.mock('../../../hooks/useFunnelConfig.js', () => ({
  useFunnelConfig: () => ({ sources: [], stages: state.stages }),
  funnelStageMeta: key => state.stages.find(s => s.stageKey === key),
  funnelStageOrder: () => state.stages.map(s => s.stageKey),
}));
vi.mock('../../../components/ConfirmDialog.jsx', () => ({ useConfirm: () => [null, vi.fn()] }));
vi.mock('../ContactProfileModal.jsx', () => ({ default: () => null }));
vi.mock('../../../components/SearchableSelect.jsx', () => ({ default: ({ options, value, onChange }) => <select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
const keys = ['new', 'contacted', 'engaged', 'hot', 'sanctioned', 'enrolled', 'cold_lost'];
const labels = ['New Customer', 'Contacted', 'CIBIL Check', 'Bank Process', 'Sanctioned', 'Closed', 'Lost'];
beforeEach(() => {
  state.stages = keys.map((stageKey, i) => ({ stageKey, label: labels[i], color: '#123456', bg: '#eeeeee', isFunnel: stageKey !== 'cold_lost' }));
  state.board.mockResolvedValue({ columns: { hot: [{ id: 1, name: 'Mukesh', stage: 'hot', followUpCount: 0 }] }, conversions: [] });
  state.move.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('configured lead stages', () => {
  it('renders all seven stage names in configured order, including an empty custom stage', async () => {
    render(<PipelinePage />);
    await screen.findByText('Mukesh');
    const headers = screen.getAllByText((text, el) => el.tagName === 'SPAN' && labels.includes(text));
    expect(headers.map(el => el.textContent)).toEqual(labels);
    expect(screen.queryByText('Hot', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Enrolled', { exact: true })).not.toBeInTheDocument();
  });
  it('reacts to renamed and reordered configuration', async () => {
    const { rerender } = render(<PipelinePage />);
    await screen.findByText('Mukesh');
    state.stages = [...state.stages].reverse().map(s => s.stageKey === 'sanctioned' ? { ...s, label: 'Approved' } : s);
    rerender(<PipelinePage />);
    const expected = state.stages.map(s => s.label);
    expect(screen.getAllByText((text, el) => el.tagName === 'SPAN' && expected.includes(text)).map(el => el.textContent)).toEqual(expected);
  });
  it('uses configured stages in New Lead and preserves the custom stage key for drag/drop', async () => {
    render(<PipelinePage />);
    const card = await screen.findByText('Mukesh');
    fireEvent.dragStart(card.closest('[draggable]'));
    const column = screen.getByText('Sanctioned').parentElement.parentElement.nextElementSibling;
    fireEvent.drop(column);
    await waitFor(() => expect(state.move).toHaveBeenCalledWith(1, 'sanctioned'));
    fireEvent.click(screen.getByText('New Lead'));
    const option = screen.getByRole('option', { name: 'Sanctioned' });
    expect([...option.parentElement.options].map(o => o.textContent)).toEqual(labels);
    expect(option.value).toBe('sanctioned');
  });
});
