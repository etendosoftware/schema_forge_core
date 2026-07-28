import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs.jsx';

function ControlledTabs({ defaultValue = 'one', onChange = () => {} }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    >
      <TabsList>
        <TabsTrigger value="one">Tab one</TabsTrigger>
        <TabsTrigger value="two">Tab two</TabsTrigger>
        <TabsTrigger value="three" badge={5}>
          Tab three
        </TabsTrigger>
      </TabsList>
      <TabsContent value="one">Content one</TabsContent>
      <TabsContent value="two">Content two</TabsContent>
      <TabsContent value="three">Content three</TabsContent>
    </Tabs>
  );
}

describe('Tabs primitives', () => {
  it('renders triggers with role="tab" and a tablist container', () => {
    render(<ControlledTabs />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const triggers = screen.getAllByRole('tab');
    expect(triggers).toHaveLength(3);
  });

  it('marks the active trigger with aria-selected="true" and others with "false"', () => {
    render(<ControlledTabs defaultValue="two" />);
    const [tabOne, tabTwo, tabThree] = screen.getAllByRole('tab');
    expect(tabOne).toHaveAttribute('aria-selected', 'false');
    expect(tabTwo).toHaveAttribute('aria-selected', 'true');
    expect(tabThree).toHaveAttribute('aria-selected', 'false');
  });

  it('renders only the active TabsContent (others are hidden)', () => {
    render(<ControlledTabs defaultValue="one" />);
    expect(screen.getByText('Content one')).toBeInTheDocument();
    expect(screen.queryByText('Content two')).not.toBeInTheDocument();
    expect(screen.queryByText('Content three')).not.toBeInTheDocument();
  });

  it('switches the active content when a trigger is clicked', () => {
    render(<ControlledTabs />);
    fireEvent.click(screen.getByText('Tab two'));
    expect(screen.getByText('Content two')).toBeInTheDocument();
    expect(screen.queryByText('Content one')).not.toBeInTheDocument();
  });

  it('calls onValueChange with the new value', () => {
    const onChange = vi.fn();
    render(<ControlledTabs onChange={onChange} />);
    fireEvent.click(screen.getByText('Tab two'));
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('renders the badge content when provided', () => {
    render(<ControlledTabs />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders an icon when an icon prop is passed', () => {
    function IconStub(props) {
      return <svg data-testid="trigger-icon" {...props} />;
    }
    render(
      <Tabs value="x" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="x" icon={IconStub}>
            With icon
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    // TabsTrigger stamps its own data-testid="Icon__fa4214" on the icon (spread
    // after caller props), so it overrides the stub's testid — assert on the
    // stamped testid to confirm the icon element actually rendered.
    expect(screen.getByTestId('Icon__fa4214')).toBeInTheDocument();
  });

  it('TabsContent without a matching value renders nothing (outside the active tab)', () => {
    render(
      <Tabs value="one" onValueChange={() => {}}>
        <TabsContent value="zzz">Should not render</TabsContent>
      </Tabs>,
    );
    expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
  });
});

// ETP-4553 / GitHub #901 — Tabs, TabsList, TabsTrigger and TabsContent used to
// destructure only their own known props, so any extra prop a caller passed
// (data-testid, aria-label, an event handler, etc.) was silently dropped
// instead of reaching the rendered element. Discovered via EditAccountModal's
// (ETP-4530) data-testid usages; the fix is a generic `...rest` spread on all
// four primitives.
describe('Tabs primitives — extra prop passthrough (ETP-4553)', () => {
  it('spreads extra props (data-testid) onto Tabs', () => {
    const { container } = render(
      <Tabs value="x" onValueChange={() => {}} data-testid="my-tabs">
        <TabsList>
          <TabsTrigger value="x">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(container.querySelector('[data-testid="my-tabs"]')).toBeInTheDocument();
  });

  it('spreads extra props (data-testid) onto TabsList', () => {
    render(
      <Tabs value="x" onValueChange={() => {}}>
        <TabsList data-testid="my-tabslist">
          <TabsTrigger value="x">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByTestId('my-tabslist')).toBeInTheDocument();
  });

  it('spreads extra props (data-testid, aria-label) onto TabsTrigger', () => {
    render(
      <Tabs value="x" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="x" data-testid="my-tab" aria-label="My tab">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const trigger = screen.getByTestId('my-tab');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-label', 'My tab');
  });

  it('spreads extra props (data-testid) onto TabsContent', () => {
    render(
      <Tabs value="x" onValueChange={() => {}}>
        <TabsContent value="x" data-testid="my-content">Body</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId('my-content')).toBeInTheDocument();
  });
});
