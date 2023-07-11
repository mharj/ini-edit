/* eslint-disable sonarjs/no-duplicate-string */
import 'mocha';
import * as chai from 'chai';

import {handleIniData} from '../src/';

const expect = chai.expect;

const someIniFile = `# comment
[Section]
key1=value1
key2=value2

[Section2]
# comment
key3=value3
key4=value4
`;

describe('JwtManager', () => {
	it('should add ', async () => {
		const out = handleIniData(someIniFile.split('\n'), [
			{
				key: 'key1',
				value: 'some1',
			},
		]);
		expect(out).to.deep.equal([
			'# comment',
			'key1=some1',
			'[Section]',
			'key1=value1',
			'key2=value2',
			'',
			'[Section2]',
			'# comment',
			'key3=value3',
			'key4=value4',
			'',
		]);
	});
	it('should modify key with section', async () => {
		const out = handleIniData(someIniFile.split('\n'), [
			{
				section: 'Section',
				key: 'key1',
				value: 'some1',
			},
		]);
		expect(out).to.deep.equal(['# comment', '[Section]', 'key1=some1', 'key2=value2', '', '[Section2]', '# comment', 'key3=value3', 'key4=value4', '']);
	});
});
