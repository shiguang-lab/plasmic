import json
from pathlib import Path
import unittest

from check_plan import check

HERE = Path(__file__).resolve().parent
CASES = {c['id']: c for c in json.loads((HERE / 'expected.json').read_text(encoding='utf-8'))['cases']}


def spec(name, component, **extra):
    return {'nodeName': name, 'component': component, 'role': 'widget', **extra}


def list_plan():
    return {'pages': [{'path': '/suppliers', 'pageType': 'list', 'components': [
        spec('AppShell', 'plasmic-overseas-app-shell'),
        spec('Filters', 'plasmic-overseas-search-form', props={'colSpan': 6}),
        spec('ListCard', 'plasmic-antd6-card', header='title+extra', headerReason='actions', props={'size': 'medium'}),
        spec('Suppliers', 'plasmic-antd6-table', props={'size': 'large'}),
        spec('RowActions', 'plasmic-react-ui-action-group'),
        spec('StateBadge', 'plasmic-antd6-badge')]}]}


class CheckPlanTests(unittest.TestCase):
    def test_every_case_names_an_existing_requirement_and_known_page_type(self):
        import sys
        sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
        from verify_selection import PAGE_TYPES
        self.assertEqual(sorted(CASES), sorted(PAGE_TYPES))
        for case in CASES.values():
            self.assertTrue((HERE / case['requirement']).is_file(), case['requirement'])
            self.assertEqual(case['id'], case['pageType'])

    def test_conforming_plan_passes_and_each_decision_is_graded(self):
        self.assertEqual(check(CASES['list'], list_plan()), [])
        plan = list_plan()
        plan['pages'][0]['pageType'] = 'tabbed-list'
        plan['pages'][0]['components'][2]['header'] = 'none'
        plan['pages'][0]['components'][3]['props']['size'] = 'medium'
        plan['pages'][0]['components'].append(spec('Info', 'plasmic-antd6-descriptions'))
        failures = check(CASES['list'], plan)
        self.assertEqual(len(failures), 4, failures)

    def test_form_layout_and_wireframe_need_their_inventories(self):
        case = CASES['basic-form']
        plan = {'pages': [{'path': '/coupons/new', 'pageType': 'basic-form', 'wireframe': {'items': [{'text': '券名称[____]', 'node': 'NameItem'}]},
                           'components': [spec('FormCard', 'plasmic-antd6-card', header='none'),
                                          spec('CouponForm', 'plasmic-antd6-form', props={'layout': 'horizontal', 'labelAlign': 'right'}),
                                          spec('Validity', 'plasmic-antd6-date-range-picker')]}]}
        failures = check(case, plan)
        self.assertIn('Form layout expectations need --forms', failures)
        self.assertTrue(any('券类型▾' in f for f in failures))
        forms = {'pages': [{'path': '/coupons/new', 'forms': [{'formLayout': 'horizontal', 'labelWidth': {'measuredPx': 96},
                                                               'layout': {'container': 'Fields', 'columns': 3},
                                                               'fields': [{'span': 1}] * 7 + [{'span': 3}]}]}]}
        self.assertFalse([f for f in check(case, plan, forms) if 'layout' in f or 'Form' in f or 'full-row' in f])


if __name__ == '__main__':
    unittest.main()
