// @covers packages/etendo-go-core/src/onboarding/components/OnboardingLanguageSelect.jsx
// @covers packages/app-shell-core/src/components/ui/select.jsx
import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@etendosoftware/app-shell-core/components/ui/select';
import { OnboardingLanguageSelect } from '../OnboardingLanguageSelect.jsx';

/**
 * ETP-4444 (scope) + ETP-4663 (Register override) — contract of the onboarding
 * language selector, observed on the rendered Radix Select instead of on the
 * source text of OnboardingLanguageSelect.jsx.
 *
 * History this file has to keep pinning: the selector was added implicitly,
 * removed by mistake (no test caught it), restored, then reworked from a native
 * <select> to the shared Radix Select with one LocaleFlagIcon per option — an
 * explicit reversal of the earlier "no flag in options" decision. A third
 * design-review pass layered three visual treatments on THIS component only
 * (open-state ring, checked-item background, Figma heading style) because the
 * shared `select.jsx` primitive serves lookups/forms app-wide and must not
 * inherit onboarding-specific styling.
 *
 * The flag icon's own internals (region → SVG branches, colours, aria-hidden)
 * are covered by test/localeFlagIcon.test.js; this file only asserts the
 * integration — that a flag is rendered per option, from the option's locale.
 */

const OPTIONS = [
  { value: 'es_ES', label: 'Español' },
  { value: 'en_US', label: 'English' },
];

const LABEL = 'Idioma';
const WRAPPER_TESTID = 'OnboardingLanguageSelect__79cf84';

// Radix's Select trigger calls `hasPointerCapture`/`releasePointerCapture`,
// which jsdom does not implement. Without these stubs every pointer
// interaction throws "target.hasPointerCapture is not a function".
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};

afterEach(() => {
  cleanup();
});

function renderSelect({ locale = 'es_ES', onChange = vi.fn(), options = OPTIONS } = {}) {
  const utils = render(
    <OnboardingLanguageSelect
      label={LABEL}
      locale={locale}
      onChange={onChange}
      options={options}
      data-testid={WRAPPER_TESTID}
    />,
  );
  return { ...utils, onChange };
}

async function openListbox(trigger, user = userEvent.setup()) {
  await user.click(trigger);
  return screen.findByRole('listbox');
}

/**
 * Radix labels each option's text node with `aria-labelledby`, which is also how
 * the accessible name is built — so this reads the option through the same
 * wiring a screen reader uses instead of guessing at class names.
 */
function itemTextOf(option) {
  return document.getElementById(option.getAttribute('aria-labelledby'));
}

/** The flag LocaleFlagIcon rendered inside an option's text node. */
function flagOf(option) {
  return itemTextOf(option).firstElementChild.firstElementChild;
}

describe('OnboardingLanguageSelect', () => {
  it('exposes the label prop as the combobox accessible name and as its visible label', () => {
    const { container } = renderSelect();

    // Accessible name: a screen-reader user hears "Idioma" on the closed control.
    const trigger = screen.getByRole('combobox', { name: LABEL });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // The same label is associated with the control through <Label htmlFor>.
    const label = container.querySelector(`label[for="${trigger.id}"]`);
    expect(label).not.toBeNull();
    expect(label.textContent).toBe(LABEL);
  });

  it('shows the selected locale flag and label in the closed control', () => {
    const spanish = renderSelect({ locale: 'es_ES' });
    const spanishTrigger = screen.getByRole('combobox', { name: LABEL });
    const spanishValue = spanishTrigger.firstElementChild;
    expect(spanishValue.textContent.trim()).toBe('Español');
    const spanishFlag = spanishValue.querySelector('svg');
    expect(spanishFlag).not.toBeNull();
    // A real circular SVG, not an emoji glyph.
    expect(spanishFlag.getAttribute('aria-hidden')).toBe('true');
    const spanishFlagMarkup = spanishFlag.outerHTML;
    spanish.unmount();

    renderSelect({ locale: 'en_US' });
    const englishTrigger = screen.getByRole('combobox', { name: LABEL });
    const englishValue = englishTrigger.firstElementChild;
    expect(englishValue.textContent.trim()).toBe('English');
    const englishFlag = englishValue.querySelector('svg');
    expect(englishFlag).not.toBeNull();

    // The flag is derived from the locale, so the two renders cannot show the same glyph.
    expect(englishFlag.outerHTML).not.toBe(spanishFlagMarkup);
  });

  it('renders one option per locale, each prefixed by that locale flag', async () => {
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('combobox', { name: LABEL });
    const user = userEvent.setup();
    await openListbox(trigger, user);

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(OPTIONS.map((option) => option.label));
    expect(screen.getByRole('option', { name: 'Español' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy();

    for (const option of options) {
      const itemText = itemTextOf(option);
      const prefix = itemText.firstElementChild;
      // The flag is the first thing rendered; the locale's name is the text after it.
      expect(prefix.firstElementChild.querySelector('svg')).not.toBeNull();
      expect(prefix.lastChild.nodeType).toBe(Node.TEXT_NODE);
      expect(prefix.lastChild.textContent).toBe(option.textContent);
    }

    const [spanishFlag, englishFlag] = options.map(flagOf);
    expect(spanishFlag.outerHTML).not.toBe(englishFlag.outerHTML);

    // Opening the list is not a choice.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('heads the option group with the label prop, before the options', async () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: LABEL });
    await openListbox(trigger, userEvent.setup());

    const listbox = screen.getByRole('listbox');
    const group = within(listbox).getByRole('group');
    const heading = within(listbox).getByText(LABEL);

    // Radix requires SelectLabel to be a descendant of SelectGroup; rendering
    // would throw `SelectLabel must be used within SelectGroup` otherwise. The
    // group names itself after the heading, and the heading precedes the options.
    expect(group.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(group.firstElementChild).toBe(heading);
    expect(heading.compareDocumentPosition(screen.getAllByRole('option')[0])
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The Figma heading treatment is applied to this heading element.
    expect(heading.className).toContain('px-4 py-1 text-xs font-normal leading-6 text-[#6C6C89]');
  });

  it('forwards the chosen locale to onChange', async () => {
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('combobox', { name: LABEL });
    const user = userEvent.setup();
    await openListbox(trigger, user);

    await user.click(screen.getByRole('option', { name: 'English' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('en_US');
  });

  it('is a combobox, not a native select', () => {
    const { container } = renderSelect();

    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('combobox')).toBeTruthy();
    // Native <option> elements only exist inside Radix's hidden <select> mirror,
    // never as a visible list while the control is closed.
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('scopes the three ETP-4444 treatments to this component elements', async () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: LABEL });

    // 1. Open-state ring lives on the trigger, driven by the state Radix sets.
    expect(trigger.className).toContain('data-[state=open]:ring-1');
    expect(trigger.className).toContain('data-[state=open]:ring-ring');

    await openListbox(trigger, userEvent.setup());
    expect(trigger.getAttribute('data-state')).toBe('open');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // 2. Checked-item background lives on the option that Radix marks as checked.
    const checked = screen.getByRole('option', { name: 'Español' });
    expect(checked.getAttribute('data-state')).toBe('checked');
    expect(checked.className).toContain('data-[state=checked]:bg-[rgba(18,18,23,0.05)]');
    const unchecked = screen.getByRole('option', { name: 'English' });
    expect(unchecked.getAttribute('data-state')).toBe('unchecked');
  });

  it('does not leak those treatments into the shared select primitive', async () => {
    // Render the shared primitives bare, exactly as every other app-wide
    // consumer (lookups, process dialogs, forms) uses them.
    render(
      <Select value="es_ES" onValueChange={() => {}}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Idioma</SelectLabel>
            <SelectItem value="es_ES">Español</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger.className).not.toContain('data-[state=open]:ring');

    await openListbox(trigger, userEvent.setup());
    expect(trigger.getAttribute('data-state')).toBe('open');

    const item = screen.getByRole('option', { name: 'Español' });
    expect(item.getAttribute('data-state')).toBe('checked');
    expect(item.className).not.toContain('data-[state=checked]:bg-[rgba(18,18,23,0.05)]');

    const heading = screen.getByText('Idioma');
    expect(heading.className).not.toContain('text-[#6C6C89]');
  });
});
