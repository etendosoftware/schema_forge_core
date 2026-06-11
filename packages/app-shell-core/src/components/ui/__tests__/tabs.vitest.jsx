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
    expect(screen.getByTestId('trigger-icon')).toBeInTheDocument();
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
