<?php
namespace verbb\navigation\models;

use craft\behaviors\FieldLayoutBehavior;
use verbb\navigation\elements\Node;
use verbb\navigation\records\Nav as NavRecord;

use Craft;
use craft\base\Model;
use craft\helpers\ArrayHelper;
use craft\validators\HandleValidator;
use craft\validators\UniqueValidator;

class Nav extends Model
{
    // Public Properties
    // =========================================================================

    public $id;
    public $name;
    public $handle;
    public $instructions;
    public $sortOrder;
    public $propagateNodes = false;
    public $maxNodes;
    public $maxLevels;
    public $permissions = [];
    public $siteSettings = [];
    public $structureId;
    public $fieldLayoutId;
    public $uid;


    // Public Methods
    // =========================================================================

    public function __toString()
    {
        return $this->handle;
    }

    public function attributeLabels()
    {
        return [
            'handle' => Craft::t('app', 'Handle'),
            'name' => Craft::t('app', 'Name'),
        ];
    }

    public function rules()
    {
        return [
            [['id', 'structureId', 'maxLevels'], 'number', 'integerOnly' => true],
            [['handle'], HandleValidator::class, 'reservedWords' => ['id', 'dateCreated', 'dateUpdated', 'uid', 'title']],
            [['handle'], UniqueValidator::class, 'targetClass' => NavRecord::class],
            [['name', 'handle'], 'required'],
            [['name', 'handle'], 'string', 'max' => 255],
        ];
    }

    public function getNavFieldLayout()
    {
        $behavior = $this->getBehavior('navFieldLayout');
        return $behavior->getFieldLayout();
    }

    public function behaviors(): array
    {
        return [
            'navFieldLayout' => [
                'class' => FieldLayoutBehavior::class,
                'elementType' => Node::class,
                'idAttribute' => 'fieldLayoutId'
            ]
        ];
    }

    public function getEditableSites(): array
    {
        $sites = [];

        foreach (Craft::$app->getSites()->getEditableSites() as $site) {
            if (Craft::$app->getIsMultiSite()) {
                $enabled = $this->siteSettings[$site->uid]['enabled'] ?? false;

                // Backward compatibility, enabled if no settings yet
                if ($enabled || $this->siteSettings === null) {
                    $sites[] = $site;
                }
            } else {
                $sites[] = $site;
            }
        }

        return $sites;
    }

    public function getEditableSiteIds(): array
    {
        return ArrayHelper::getColumn($this->getEditableSites(), 'id');
    }

}
